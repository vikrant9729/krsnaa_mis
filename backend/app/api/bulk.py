from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Center, CenterTypeEnum, User
from app.services.audit import log_change
from app.services.dos_parser import parse_upload
from app.services.dos_template import generate_template_excel
from app.services.rbac import require_permission
import io

router = APIRouter(prefix="/bulk", tags=["bulk"])


@router.post("/centers")
async def bulk_upsert_centers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")
    content = await file.read()
    rows = parse_upload(content, file.filename)

    created, updated, errors = 0, 0, []
    for index, row in enumerate(rows, start=1):
        center_code = str(row.get("CC_Code") or "").strip()
        center_name = str(row.get("CC_Name") or "").strip()
        center_type = str(row.get("type") or "").upper().strip()
        if not center_code or center_type not in {"HLM", "CC", "PROJECT"}:
            errors.append({"row": index, "error": "Invalid center mapping"})
            continue

        existing = db.query(Center).filter(Center.center_code == center_code).first()
        if existing:
            existing.name = center_name or existing.name
            existing.metadata_json = {**(existing.metadata_json or {}), "partner_status": row.get("Partner_Status")}
            updated += 1
        else:
            db.add(
                Center(
                    center_code=center_code,
                    name=center_name,
                    center_type=CenterTypeEnum(center_type),
                    owner_id=str(row.get("OwnerID") or ""),
                    metadata_json={"partner_status": row.get("Partner_Status")},
                )
            )
            created += 1

    db.commit()

    log_change(
        db,
        entity_type="bulk",
        entity_id=file.filename,
        action="BULK_UPSERT_CENTERS",
        old_value=None,
        new_value={"created": created, "updated": updated, "errors": len(errors)},
        actor_id=current_user.id,
    )
    return {"created": created, "updated": updated, "errors": errors}


from fastapi import BackgroundTasks
import uuid
from app.api.jobs import UPLOAD_JOBS

@router.get("/progress/{job_id}")
async def get_upload_progress(job_id: str):
    return UPLOAD_JOBS.get(job_id, {"status": "not_found", "progress": 0})


def process_bulk_upload_task(job_id: str, rows: list, mode: str, filename: str, user_id: int):
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        from app.models.entities import DosDataset, DosRow, Center, CenterTypeEnum, MasterTest
        from sqlalchemy import insert, func
        import hashlib, json
        from collections import defaultdict
        
        UPLOAD_JOBS[job_id] = {"status": "processing", "progress": 0, "total": len(rows), "processed": 0}
        
        # Group rows by CC_Code
        groups = defaultdict(list)
        for row in rows:
            cc_code = str(row.get("CC_Code") or row.get("OwnerID") or "").strip()
            if cc_code:
                groups[cc_code].append(row)
        
        total_groups = len(groups)
        processed_groups = 0
        
        for cc_code, center_rows in groups.items():
            first = center_rows[0]
            center_name = str(first.get("CC_Name") or first.get("LAB_Name") or cc_code).strip()
            center_type_raw = str(first.get("type") or "HLM").upper().strip()
            if center_type_raw not in {"HLM", "CC", "PROJECT"}:
                center_type_raw = "HLM"

            # Upsert Center
            existing_center = db.query(Center).filter(Center.center_code == cc_code).first()
            if existing_center:
                existing_center.name = center_name
                center_obj = existing_center
            else:
                center_obj = Center(
                    center_code=cc_code,
                    name=center_name,
                    center_type=CenterTypeEnum(center_type_raw),
                    owner_id=str(first.get("OwnerID") or ""),
                )
                db.add(center_obj)
                db.flush()

            # Create Dataset
            max_version = db.query(func.max(DosDataset.version)).filter(DosDataset.center_id == center_obj.id).scalar() or 0
            db.query(DosDataset).filter(DosDataset.center_id == center_obj.id, DosDataset.is_active.is_(True)).update({"is_active": False})
            
            dataset = DosDataset(
                center_id=center_obj.id,
                version=max_version + 1,
                source_filename=filename,
                columns_json=list(center_rows[0].keys()),
                created_by=user_id,
                is_active=True,
            )
            db.add(dataset)
            db.flush()

            # Batch Insert Rows

            rows_data = []
            unique_tests = {}
            duplicate_warnings = []
            # Gather all existing test codes for this center from DB
            existing_test_codes = set(
                r.data_json.get("LAB_TestID", "").strip().upper() or r.data_json.get("Test_Code", "").strip().upper()
                for r in db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
            )
            in_file_codes = set()
            for idx, row in enumerate(center_rows):
                row_clean = {k: v for k, v in row.items()}
                t_code = str(row_clean.get("LAB_TestID") or row_clean.get("Test_Code") or "").strip().upper()
                # Warn if duplicate in file, but do not skip
                if t_code:
                    if t_code in in_file_codes:
                        duplicate_warnings.append(f"Duplicate test code {t_code} in file for center {cc_code} at row {idx+1}")
                    in_file_codes.add(t_code)
                row_hash = hashlib.sha256(json.dumps(row_clean, sort_keys=True, default=str).encode()).hexdigest()
                rows_data.append({"dataset_id": dataset.id, "row_hash": row_hash, "data_json": row_clean})
                if t_code:
                    unique_tests[t_code] = {
                        "LAB_TestID": t_code,
                        "test_name": str(row_clean.get("test_name") or row_clean.get("Test_Name") or "").strip(),
                        "TestCategory_Mapped": str(row_clean.get("TestCategory_Mapped") or row_clean.get("Category") or "").strip()
                    }
                if len(rows_data) >= 2000:
                    db.execute(insert(DosRow), rows_data)
                    rows_data = []
            if rows_data:
                db.execute(insert(DosRow), rows_data)

            # MasterTest Sync: Only insert tests not already present for this center
            batch_test_ids = list(unique_tests.keys())
            if batch_test_ids:
                # Get all test codes already present for this center in MasterTest
                existing_ids = {t.LAB_TestID for t in db.query(MasterTest.LAB_TestID).filter(MasterTest.LAB_TestID.in_(batch_test_ids)).all()}
                new_tests = [v for k, v in unique_tests.items() if k not in existing_ids]
                if new_tests:
                    db.execute(insert(MasterTest), new_tests)

            # Optionally: log duplicate_warnings somewhere, e.g., UPLOAD_JOBS[job_id]["warnings"] = duplicate_warnings
            if duplicate_warnings:
                UPLOAD_JOBS[job_id]["warnings"] = duplicate_warnings

            # MasterTest Sync
            batch_test_ids = list(unique_tests.keys())
            if batch_test_ids:
                existing_tests = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(batch_test_ids)).all()
                existing_ids = {t.LAB_TestID for t in existing_tests}
                new_tests = [v for k, v in unique_tests.items() if k not in existing_ids]
                if new_tests:
                    db.execute(insert(MasterTest), new_tests)
                    
                # Auto-Sync to CenterTest (Local Catalog)
                # First, get all MasterTests for this batch to get their actual database IDs
                all_master_tests = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(batch_test_ids)).all()
                master_test_map = {t.LAB_TestID: t.id for t in all_master_tests}
                
                # Find existing center tests for this center to avoid duplicate assignments
                from app.models.entities import CenterTest
                existing_center_tests = {
                    ct.test_id for ct in db.query(CenterTest.test_id).filter(CenterTest.center_id == center_obj.id).all()
                }
                
                new_center_tests = []
                for t_code in batch_test_ids:
                    master_id = master_test_map.get(t_code)
                    if master_id and master_id not in existing_center_tests:
                        # Extract the rate from the original row for this test
                        test_info = unique_tests[t_code]
                        bill_rate = float(test_info.get("Bill_Rate", 0)) if test_info.get("Bill_Rate") else 0.0
                        
                        new_center_tests.append({
                            "center_id": center_obj.id,
                            "test_id": master_id,
                            "custom_rate": bill_rate,
                        })
                        existing_center_tests.add(master_id)
                
                if new_center_tests:
                    db.execute(insert(CenterTest), new_center_tests)

            db.commit()
            processed_groups += 1
            UPLOAD_JOBS[job_id]["progress"] = int((processed_groups / total_groups) * 100)
            UPLOAD_JOBS[job_id]["processed_groups"] = processed_groups

        UPLOAD_JOBS[job_id]["status"] = "completed"
    except Exception as e:
        db.rollback()
        UPLOAD_JOBS[job_id]["status"] = "failed"
        UPLOAD_JOBS[job_id]["error"] = str(e)
    finally:
        db.close()


@router.post("/upload")
async def bulk_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: str = Form("replace"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    require_permission(current_user, "dos:upload")
    content = await file.read()
    try:
        rows = parse_upload(content, file.filename or "upload.xlsx")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"File parse error: {exc}")

    if not rows:
        return {"message": "No rows found"}

    job_id = str(uuid.uuid4())
    UPLOAD_JOBS[job_id] = {"status": "pending", "progress": 0}
    
    background_tasks.add_task(process_bulk_upload_task, job_id, rows, mode, file.filename, current_user.id)
    
    return {"job_id": job_id, "total_rows": len(rows)}


@router.delete("/centers")
def delete_all_centers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")
    
    # Get count before deletion
    total_centers = db.query(Center).count()
    
    try:
        # 1. Nullify self-references first to avoid dependency cycles
        db.query(Center).update({"parent_id": None, "base_center_id": None})
        db.flush()
        
        # 2. Delete child records in order
        db.query(DosRow).delete()
        db.query(DosDataset).delete()
        db.query(DOSVersionSnapshot).delete()
        db.query(AISuggestion).delete()
        db.query(UserCenterAssignment).delete()
        db.query(CenterTest).delete()
        db.query(AuditLog).delete()
        
        # 3. Finally delete centers
        db.query(Center).delete()
        
        db.commit()
        
        return {"message": f"Successfully deleted {total_centers} centers and all related data"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Deep delete failed: {str(e)}")


@router.get("/template")
def download_bulk_template():
    output = io.BytesIO(generate_template_excel())

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Bulk_Upload_Template.xlsx"}
    )
