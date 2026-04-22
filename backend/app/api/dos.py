from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, String, text
from sqlalchemy.orm import Session
import io
import hashlib

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import DosDataset, DosRow, User
from app.schemas.common import RateUpdateBatchRequest, DosCopyRequest
from app.services.audit import log_change
from app.services.dos_parser import parse_upload
from app.services.dos_export import export_dos_to_excel
from app.services.rbac import require_permission
from app.services.rate_update import apply_percentage_update, bulk_rate_update, preview_rate_update

router = APIRouter(prefix="/dos", tags=["dos"])


@router.get("/export/{center_id}")
def export_dos(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:read")
    try:
        excel_bytes = export_dos_to_excel(db, center_id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=DOS_Center_{center_id}.xlsx"
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(exc)}")


from fastapi import BackgroundTasks
import uuid
from app.api.jobs import UPLOAD_JOBS

def process_dos_upload_task(job_id: str, center_id: int, mode: str, parsed_rows: list, filename: str, user_id: int):
    from app.db.session import SessionLocal
    from app.models.entities import DosDataset, DosRow, MasterTest, CenterTest, Center
    from sqlalchemy import insert, func
    import hashlib, json
    
    db = SessionLocal()
    try:
        UPLOAD_JOBS[job_id] = {"status": "processing", "progress": 0, "total": len(parsed_rows), "processed": 0}
        
        # 1. Handle Append Mode logic
        existing_test_codes = set()
        existing_rows = []
        if mode == "append":
            active_dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
            if active_dataset:
                # Optimized fetching of existing codes
                existing_rows_objs = db.query(DosRow).filter(DosRow.dataset_id == active_dataset.id).all()
                for r in existing_rows_objs:
                    t_code = str(r.data_json.get("LAB_TestID") or r.data_json.get("Test_Code") or "").strip().upper()
                    if t_code:
                        existing_test_codes.add(t_code)
                    existing_rows.append(r.data_json)

        rows_to_add = []
        if mode == "append":
            for row in parsed_rows:
                t_code = str(row.get("LAB_TestID") or row.get("Test_Code") or "").strip().upper()
                if t_code and t_code in existing_test_codes:
                    continue
                rows_to_add.append(row)
            all_rows = existing_rows + rows_to_add
        else:
            all_rows = parsed_rows

        if not all_rows:
            UPLOAD_JOBS[job_id] = {"status": "completed", "progress": 100, "message": "No new tests to add"}
            return

        # 2. Create Dataset
        max_version = db.query(func.max(DosDataset.version)).filter(DosDataset.center_id == center_id).scalar() or 0
        db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).update({"is_active": False})
        
        dataset = DosDataset(
            center_id=center_id,
            version=max_version + 1,
            source_filename=filename,
            columns_json=list(all_rows[0].keys()) if all_rows else [],
            created_by=user_id,
            is_active=True,
        )
        db.add(dataset)
        db.flush()

        # 3. Batch Insert DosRow
        rows_batch = []
        unique_tests_in_batch = {}
        
        total_rows = len(all_rows)
        for idx, row in enumerate(all_rows):
            row_clean = row.copy()
            t_code = str(row_clean.get("LAB_TestID") or row_clean.get("Test_Code") or "").strip().upper()
            
            row_hash = hashlib.sha256(json.dumps(row_clean, sort_keys=True, default=str).encode()).hexdigest()
            rows_batch.append({
                "dataset_id": dataset.id, 
                "row_hash": row_hash, 
                "test_code": t_code, # POPULATE COLUMN
                "data_json": row_clean
            })
            
            if t_code:
                unique_tests_in_batch[t_code] = {
                    "LAB_TestID": t_code,
                    "test_name": str(row_clean.get("test_name") or row_clean.get("Test_Name") or "").strip(),
                    "TestCategory_Mapped": str(row_clean.get("TestCategory_Mapped") or row_clean.get("Category") or "").strip(),
                    "Bill_Rate": float(row_clean.get("Bill_Rate", 0)) if row_clean.get("Bill_Rate") else 0.0
                }

            if len(rows_batch) >= 2000:
                db.execute(insert(DosRow), rows_batch)
                rows_batch = []
                # Update progress roughly
                UPLOAD_JOBS[job_id]["progress"] = int((idx / total_rows) * 80) # Use up to 80% for row insertion
                UPLOAD_JOBS[job_id]["processed"] = idx
                
        if rows_batch:
            db.execute(insert(DosRow), rows_batch)

        # 4. Sync MasterTest & CenterTest
        batch_test_ids = list(unique_tests_in_batch.keys())
        if batch_test_ids:
            # Sync MasterTest
            existing_master_ids = {t.LAB_TestID for t in db.query(MasterTest.LAB_TestID).filter(MasterTest.LAB_TestID.in_(batch_test_ids)).all()}
            new_master_entries = [
                {
                    "LAB_TestID": v["LAB_TestID"],
                    "test_name": v["test_name"],
                    "TestCategory_Mapped": v["TestCategory_Mapped"]
                }
                for k, v in unique_tests_in_batch.items() if k not in existing_master_ids
            ]
            if new_master_entries:
                db.execute(insert(MasterTest), new_master_entries)
                db.flush()

            # 4.5 NEW: If this is a BASE CENTER, update Master MRP for ALL items in batch
            center_info = db.query(Center).filter(Center.id == center_id).first()
            if center_info and center_info.is_base_center:
                print(f"Base Center {center_id} detected. Propagating MRP to Master Data...")
                for t_code, v in unique_tests_in_batch.items():
                    rate = v["Bill_Rate"]
                    if rate > 0:
                        db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).update({
                            "custom_mrp": rate,
                            "mrp_source": center_info.name
                        }, synchronize_session=False)
                db.flush()

            # Sync CenterTest
            all_master = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(batch_test_ids)).all()
            master_map = {t.LAB_TestID: t.id for t in all_master}
            
            new_center_tests = []
            update_center_tests = []
            
            # Map existing center tests for this center
            existing_ct_map = {ct.test_id: ct for ct in db.query(CenterTest).filter(CenterTest.center_id == center_id).all()}
            
            for t_code, master_id in master_map.items():
                new_rate = unique_tests_in_batch[t_code]["Bill_Rate"]
                if master_id not in existing_ct_map:
                    new_center_tests.append({
                        "center_id": center_id,
                        "test_id": master_id,
                        "custom_rate": new_rate,
                    })
                else:
                    # Update existing rate if it changed
                    ct = existing_ct_map[master_id]
                    if ct.custom_rate != new_rate:
                        ct.custom_rate = new_rate
            
            if new_center_tests:
                for i in range(0, len(new_center_tests), 1000):
                    db.execute(insert(CenterTest), new_center_tests[i:i+1000])

            # Force commit all changes
            db.commit()
            
            # 5. NEW: Auto-repair CenterTest MRP for non-base centers
            # If we just uploaded a DOS for a center, make sure its CenterTest records match the DOS rates
            # This is already done above in the loop, but let's ensure Master MRP is also consistent.
        UPLOAD_JOBS[job_id]["status"] = "completed"
        UPLOAD_JOBS[job_id]["progress"] = 100
        UPLOAD_JOBS[job_id]["dataset_id"] = dataset.id
        
    except Exception as e:
        db.rollback()
        UPLOAD_JOBS[job_id]["status"] = "failed"
        UPLOAD_JOBS[job_id]["error"] = str(e)
    finally:
        db.close()


@router.post("/upload")
async def upload_dos(
    background_tasks: BackgroundTasks,
    center_id: int = Form(...),
    mode: str = Form("replace"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:upload")

    content = await file.read()
    try:
        parsed_rows = parse_upload(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"File parse error: {exc}")

    if not parsed_rows:
        return {"message": "No rows found"}

    job_id = str(uuid.uuid4())
    UPLOAD_JOBS[job_id] = {"status": "pending", "progress": 0}
    
    background_tasks.add_task(process_dos_upload_task, job_id, center_id, mode, parsed_rows, file.filename, current_user.id)
    
    return {"job_id": job_id, "total_rows": len(parsed_rows)}


@router.delete("/rows/{row_id}")
def delete_dos_row(
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    row = db.query(DosRow).filter(DosRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    
    # Logic: Instead of just deleting the row from the dataset (which might break version integrity),
    # we should ideally create a NEW version of the dataset without this row.
    # But for simplicity and direct user request, we'll allow deleting it from the active dataset.
    
    dataset = db.query(DosDataset).filter(DosDataset.id == row.dataset_id).first()
    if not dataset.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete from inactive dataset. Please edit the active one.")

    db.delete(row)
    db.commit()
    
    log_change(
        db,
        entity_type="dos_row",
        entity_id=str(row_id),
        action="DELETE",
        old_value=row.data_json,
        new_value=None,
        actor_id=current_user.id,
    )
    return {"status": "success"}


@router.patch("/rows/{row_id}")
def update_dos_row(
    row_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    row = db.query(DosRow).filter(DosRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    
    old_data = row.data_json.copy()
    row.data_json.update(data)
    
    # Force SQLAlchemy to detect the change in JSON
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(row, "data_json")
    
    db.commit()
    
    log_change(
        db,
        entity_type="dos_row",
        entity_id=str(row_id),
        action="UPDATE",
        old_value=old_data,
        new_value=row.data_json,
        actor_id=current_user.id,
    )
    return row


@router.post("/rows")
def add_manual_test(
    center_id: int,
    test_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:write")
    
    active_dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
    if not active_dataset:
        # Create a new dataset if none exists
        active_dataset = DosDataset(
            center_id=center_id,
            version=1,
            source_filename="manual_entry",
            columns_json=list(test_data.keys()),
            created_by=current_user.id,
            is_active=True,
        )
        db.add(active_dataset)
        db.commit()
        db.refresh(active_dataset)
    
    import hashlib
    row_hash = hashlib.sha256(str(test_data).encode()).hexdigest()
    
    new_row = DosRow(
        dataset_id=active_dataset.id,
        test_code=t_code,
        row_hash=row_hash,
        data_json=test_data
    )
    db.add(new_row)
    
    # Sync MasterTest
    from app.models.entities import MasterTest
    t_code = str(test_data.get("LAB_TestID") or test_data.get("Test_Code") or "").strip()
    if t_code:
        exists = db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).first()
        if not exists:
            db.add(MasterTest(
                LAB_TestID=t_code,
                test_name=str(test_data.get("test_name") or test_data.get("Test_Name") or test_data.get("Test_Description") or "").strip(),
                TestCategory_Mapped=str(test_data.get("TestCategory_Mapped") or test_data.get("Category") or test_data.get("Department") or "").strip(),
            ))
            
    db.commit()
    db.refresh(new_row)
    
    log_change(
        db,
        entity_type="dos_row",
        entity_id=str(new_row.id),
        action="CREATE_MANUAL",
        old_value=None,
        new_value=test_data,
        actor_id=current_user.id,
    )
    return new_row


@router.post("/rate-update")
def update_rates_legacy(
    center_id: int = Form(...),
    percentage: float = Form(...),
    column_name: str = Form("Bill_Rate"),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "rate:update")

    dataset = (
        db.query(DosDataset)
        .filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True))
        .order_by(DosDataset.version.desc())
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Active dataset not found")

    updated = apply_percentage_update(
        db,
        dataset_id=dataset.id,
        percentage=percentage,
        column_name=column_name,
        category=category,
    )

    log_change(
        db,
        entity_type="dos_dataset",
        entity_id=str(dataset.id),
        action="RATE_UPDATE",
        old_value={"category": category, "column_name": column_name},
        new_value={"percentage": percentage, "updated_rows": updated},
        actor_id=current_user.id,
    )

    return {"updated_rows": updated}


@router.get("/datasets/{center_id}")
def get_datasets(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    datasets = db.query(DosDataset).filter(DosDataset.center_id == center_id).order_by(DosDataset.version.desc()).all()
    return datasets


@router.get("/data/{dataset_id}")
def get_dataset_rows(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset_id).all()
    return rows


@router.post("/rate-preview/{dataset_id}")
def preview_rates(
    dataset_id: int,
    payload: RateUpdateBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "rate:update")

    dataset = db.query(DosDataset).filter(DosDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not payload.updates:
        raise HTTPException(status_code=400, detail="At least one update rule is required")

    all_previews = []
    for update in payload.updates:
        try:
            preview = preview_rate_update(
                db,
                dataset_id=dataset_id,
                percentage=update.percentage,
                column_name=update.column_name,
                category=update.category or None,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        all_previews.extend(preview)
    return all_previews


@router.post("/rate-update/{dataset_id}")
def update_rates_for_dataset(
    dataset_id: int,
    payload: RateUpdateBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "rate:update")

    dataset = db.query(DosDataset).filter(DosDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not payload.updates:
        raise HTTPException(status_code=400, detail="At least one update rule is required")

    try:
        result = bulk_rate_update(
            db,
            dataset_id=dataset_id,
            updates=[
                {
                    "column_name": update.column_name,
                    "category": update.category or None,
                    "percentage": update.percentage,
                }
                for update in payload.updates
            ],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_change(
        db,
        entity_type="dos_dataset",
        entity_id=str(dataset_id),
        action="RATE_UPDATE",
        old_value=None,
        new_value=result,
        actor_id=current_user.id,
    )

    return result


@router.get("/list")
def list_dos_rows(
    center_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:read")
    
    query = db.query(DosRow).join(DosDataset)
    
    if center_id and center_id.strip():
        try:
            cid = int(center_id)
            query = query.filter(DosDataset.center_id == cid, DosDataset.is_active == True)
        except ValueError:
            pass
    
    if search:
        search_filter = f"%{search}%"
        # Optimize: search in common keys first or use a more efficient cast if Postgres
        query = query.filter(
            (func.cast(DosRow.data_json, String).ilike(search_filter))
        )
    
    total = query.count()
    skip = (page - 1) * page_size
    items = query.order_by(DosRow.id.desc()).offset(skip).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@router.get("/categories/{center_id}")
def get_categories(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = (
        db.query(DosDataset)
        .filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True))
        .order_by(DosDataset.version.desc())
        .first()
    )
    if not dataset:
        return []
    
    # SQL-based category extraction for speed
    # We use distinct on the specific keys we know are used for categories
    categories_res = db.execute(text("""
        SELECT DISTINCT 
            COALESCE(data_json->>'TestCategory_Mapped', data_json->>'Category') as cat
        FROM dos_rows 
        WHERE dataset_id = :ds_id
        AND (data_json->>'TestCategory_Mapped' IS NOT NULL OR data_json->>'Category' IS NOT NULL)
    """), {"ds_id": dataset.id})
    
    return [r[0] for r in categories_res.fetchall() if r[0]]


@router.post("/copy")
def copy_dos(
    payload: DosCopyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:upload")

    # 1. Get source dataset
    source_dataset = (
        db.query(DosDataset)
        .filter(DosDataset.center_id == payload.source_center_id, DosDataset.is_active == True)
        .first()
    )
    if not source_dataset:
        raise HTTPException(status_code=404, detail="Source center has no active DOS dataset")

    # 2. Get target center info
    from app.models.entities import Center
    target_center = db.query(Center).filter(Center.id == payload.target_center_id).first()
    if not target_center:
        raise HTTPException(status_code=404, detail="Target center not found")

    # 3. Get source rows
    source_rows = db.query(DosRow).filter(DosRow.dataset_id == source_dataset.id).all()
    
    # Filter by categories if provided
    if payload.categories:
        source_rows = [
            r for r in source_rows 
            if (r.data_json.get("TestCategory_Mapped") or r.data_json.get("Category")) in payload.categories
        ]

    if not source_rows:
        raise HTTPException(status_code=400, detail="No rows found matching the criteria in source center")

    # 4. Create target dataset
    max_version = db.query(func.max(DosDataset.version)).filter(DosDataset.center_id == payload.target_center_id).scalar() or 0
    target_dataset = DosDataset(
        center_id=payload.target_center_id,
        version=max_version + 1,
        source_filename=f"COPIED_FROM_CENTER_{payload.source_center_id}",
        columns_json=source_dataset.columns_json,
        copied_from=source_dataset.id,
        created_by=current_user.id,
        is_active=True,
    )

    # Deactivate old target datasets
    db.query(DosDataset).filter(DosDataset.center_id == payload.target_center_id, DosDataset.is_active == True).update({"is_active": False})

    db.add(target_dataset)
    db.flush()

    # 5. Create target rows with updated center info
    for s_row in source_rows:
        new_data = s_row.data_json.copy()
        
        # Update center-specific fields
        if "CC_Code" in new_data:
            new_data["CC_Code"] = target_center.center_code
        if "CC_Name" in new_data:
            new_data["CC_Name"] = target_center.name
        if "OwnerID" in new_data:
            new_data["OwnerID"] = target_center.owner_id or ""
        if "LAB_Name" in new_data:
            new_data["LAB_Name"] = target_center.name
            
        new_row = DosRow(
            dataset_id=target_dataset.id,
            test_code=s_row.test_code,
            row_hash=hashlib.sha256(str(new_data).encode()).hexdigest(),
            data_json=new_data
        )
        db.add(new_row)
    
    db.commit()

    log_change(
        db,
        entity_type="dos_dataset",
        entity_id=str(target_dataset.id),
        action="COPY",
        old_value={"source_center_id": payload.source_center_id},
        new_value={"rows_copied": len(source_rows), "categories": payload.categories},
        actor_id=current_user.id,
    )

    return {"status": "success", "rows_copied": len(source_rows), "dataset_id": target_dataset.id}
