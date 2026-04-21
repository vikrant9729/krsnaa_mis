from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, String
from sqlalchemy.orm import Session
import io
import hashlib

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import DosDataset, DosRow, User
from app.schemas.common import RateUpdateBatchRequest
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


@router.post("/upload")
async def upload_dos(
    center_id: int = Form(...),
    mode: str = Form("replace"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:upload")

    content = await file.read()
    parsed_rows = parse_upload(content, file.filename)
    
    # Get active dataset for existing tests if mode is append
    existing_test_codes = set()
    existing_rows = []
    if mode == "append":
        active_dataset = db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).first()
        if active_dataset:
            existing_rows_objs = db.query(DosRow).filter(DosRow.dataset_id == active_dataset.id).all()
            for r in existing_rows_objs:
                t_code = r.data_json.get("Test_Code")
                if t_code:
                    existing_test_codes.add(str(t_code).strip())
                existing_rows.append(r.data_json)

    # Filter out existing tests if mode is append
    rows_to_add = []
    if mode == "append":
        new_tests_count = 0
        for row in parsed_rows:
            t_code = row.get("Test_Code")
            if t_code and str(t_code).strip() in existing_test_codes:
                continue
            rows_to_add.append(row)
            new_tests_count += 1
        
        # In append mode, the new dataset should contain BOTH old and new rows
        # so that it remains a complete snapshot of the center's DOS
        all_rows = existing_rows + rows_to_add
    else:
        all_rows = parsed_rows

    if not all_rows:
        return {"message": "No new tests to add", "rows": 0}

    max_version = db.query(func.max(DosDataset.version)).filter(DosDataset.center_id == center_id).scalar() or 0
    dataset = DosDataset(
        center_id=center_id,
        version=max_version + 1,
        source_filename=file.filename,
        columns_json=list(all_rows[0].keys()) if all_rows else [],
        created_by=current_user.id,
        is_active=True,
    )

    # Deactivate old datasets
    db.query(DosDataset).filter(DosDataset.center_id == center_id, DosDataset.is_active.is_(True)).update({"is_active": False})

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    unique_tests_in_batch = {}
    for row in all_rows:
        row_clean = row.copy()
        row_hash = row_clean.pop("__row_hash", None) or hashlib.sha256(str(row_clean).encode()).hexdigest()
        db.add(DosRow(dataset_id=dataset.id, row_hash=row_hash, data_json=row_clean))
        
        # Collect for MasterTest
        t_code = str(row_clean.get("Test_Code") or "").strip()
        if t_code:
            unique_tests_in_batch[t_code] = {
                "test_code": t_code,
                "test_name": str(row_clean.get("test_name") or row_clean.get("Test_Name") or "").strip(),
                "category": str(row_clean.get("TestCategory_Mapped") or row_clean.get("Category") or "").strip(),
            }

    # Sync MasterTest
    from app.models.entities import MasterTest
    for t_code, t_data in unique_tests_in_batch.items():
        exists = db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).first()
        if not exists:
            db.add(MasterTest(
                LAB_TestID=t_data["test_code"],
                test_name=t_data["test_name"],
                TestCategory_Mapped=t_data["category"]
            ))
            
    db.commit()

    log_change(
        db,
        entity_type="dos_dataset",
        entity_id=str(dataset.id),
        action="UPLOAD",
        old_value=None,
        new_value={"rows": len(all_rows), "mode": mode, "new_added": len(rows_to_add) if mode == "append" else len(all_rows)},
        actor_id=current_user.id,
    )

    return {"dataset_id": dataset.id, "rows": len(all_rows), "new_added": len(rows_to_add) if mode == "append" else len(all_rows)}


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
        # Search in JSON cast to string
        query = query.filter(func.cast(DosRow.data_json, String).ilike(search_filter))
    
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
    
    rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
    categories = set()
    for row in rows:
        # Check both new and old names in data_json
        cat = row.data_json.get("TestCategory_Mapped") or row.data_json.get("Category")
        if cat:
            categories.add(cat)
    return list(categories)
