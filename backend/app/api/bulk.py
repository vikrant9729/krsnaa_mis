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


@router.post("/upload")
async def bulk_upload(
    mode: str = Form("replace"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dos:upload")
    content = await file.read()

    # --- Parse file ---
    try:
        rows = parse_upload(content, file.filename or "upload.xlsx")
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"File parse error: {exc}")

    if not rows:
        return {"results": [], "success": 0, "failed": 0}

    # --- Import models needed ---
    from app.models.entities import DosDataset, DosRow
    from sqlalchemy import func
    import hashlib, json

    # --- Group rows by CC_Code ---
    from collections import defaultdict
    groups: dict = defaultdict(list)
    for row in rows:
        cc_code = str(row.get("CC_Code") or row.get("OwnerID") or "").strip()
        if cc_code:
            groups[cc_code].append(row)

    results = []
    success_count = 0
    failed_count = 0

    for cc_code, center_rows in groups.items():
        first = center_rows[0]
        center_name = str(first.get("CC_Name") or first.get("LAB_Name") or cc_code).strip()
        center_type_raw = str(first.get("type") or "HLM").upper().strip()

        # Normalise center type — accept HLM, CC, PROJECT only
        if center_type_raw not in {"HLM", "CC", "PROJECT"}:
            center_type_raw = "HLM"

        try:
            # Upsert Center
            existing_center = db.query(Center).filter(Center.center_code == cc_code).first()
            if existing_center:
                existing_center.name = center_name
                existing_center.metadata_json = {
                    **(existing_center.metadata_json or {}),
                    "partner_status": first.get("Partner_Status"),
                    "center_type_label": first.get("center type"),
                }
                center_obj = existing_center
            else:
                center_obj = Center(
                    center_code=cc_code,
                    name=center_name,
                    center_type=CenterTypeEnum(center_type_raw),
                    owner_id=str(first.get("OwnerID") or ""),
                    metadata_json={
                        "partner_status": first.get("Partner_Status"),
                        "center_type_label": first.get("center type"),
                    },
                )
                db.add(center_obj)
                db.flush()  # get center_obj.id

            existing_test_codes = set()
            existing_rows = []
            if mode == "append":
                active_dataset = db.query(DosDataset).filter(DosDataset.center_id == center_obj.id, DosDataset.is_active.is_(True)).first()
                if active_dataset:
                    existing_rows_objs = db.query(DosRow).filter(DosRow.dataset_id == active_dataset.id).all()
                    for r in existing_rows_objs:
                        t_code = r.data_json.get("Test_Code")
                        if t_code:
                            existing_test_codes.add(str(t_code).strip())
                        existing_rows.append(r.data_json)
            
            rows_to_add = []
            if mode == "append":
                for row in center_rows:
                    t_code = row.get("Test_Code")
                    if t_code and str(t_code).strip() in existing_test_codes:
                        continue
                    rows_to_add.append(row)
                all_rows = existing_rows + rows_to_add
            else:
                all_rows = center_rows

            max_version = db.query(func.max(DosDataset.version)).filter(DosDataset.center_id == center_obj.id).scalar() or 0
            
            # Deactivate old datasets for this center
            db.query(DosDataset).filter(DosDataset.center_id == center_obj.id, DosDataset.is_active.is_(True)).update({"is_active": False})

            # Create a new DosDataset version for this center
            col_names = list(all_rows[0].keys()) if all_rows else []
            dataset = DosDataset(
                center_id=center_obj.id,
                version=max_version + 1,
                source_filename=file.filename or "bulk_upload.xlsx",
                columns_json=col_names,
                created_by=current_user.id,
                is_active=True,
            )
            db.add(dataset)
            db.flush()  # get dataset.id

            # Insert DosRows and collect for MasterTest sync
            unique_tests_in_batch = {}
            for row in all_rows:
                row_clean = {k: v for k, v in row.items() if k != "__row_hash"}
                row_hash = hashlib.sha256(json.dumps(row_clean, sort_keys=True, default=str).encode()).hexdigest()
                db.add(DosRow(
                    dataset_id=dataset.id,
                    row_hash=row_hash,
                    data_json=row_clean,
                ))
                
                # Collect for MasterTest - prioritized LAB_TestID as requested
                t_code = str(row_clean.get("LAB_TestID") or row_clean.get("Test_Code") or "").strip()
                if t_code:
                    unique_tests_in_batch[t_code] = {
                        "test_code": t_code,
                        "test_name": str(row_clean.get("test_name") or row_clean.get("Test_Name") or row_clean.get("Test_Description") or "").strip(),
                        "category": str(row_clean.get("TestCategory_Mapped") or row_clean.get("Category") or row_clean.get("Department") or "").strip(),
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

            results.append({
                "center_code": cc_code,
                "center_name": center_name,
                "status": "success",
                "message": f"{len(center_rows)} rows uploaded",
                "rows": len(center_rows),
            })
            success_count += 1

        except Exception as exc:
            db.rollback()
            results.append({
                "center_code": cc_code,
                "center_name": center_name,
                "status": "error",
                "message": str(exc),
            })
            failed_count += 1

    log_change(
        db,
        entity_type="bulk",
        entity_id=file.filename or "upload",
        action="BULK_UPLOAD_DOS",
        old_value=None,
        new_value={"success": success_count, "failed": failed_count, "total_rows": len(rows)},
        actor_id=current_user.id,
    )

    return {"results": results, "success": success_count, "failed": failed_count}


@router.delete("/centers")
def delete_all_centers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")  # Only allow users with center write permission
    
    # Get count before deletion for logging
    total_centers = db.query(Center).count()
    
    # Delete all centers - this will cascade to related data due to foreign key constraints
    db.query(Center).delete()
    db.commit()
    
    log_change(
        db,
        entity_type="bulk",
        entity_id="all_centers",
        action="DELETE_ALL_CENTERS",
        old_value={"total_centers": total_centers},
        new_value=None,
        actor_id=current_user.id,
    )
    
    return {"message": f"Successfully deleted {total_centers} centers"}


@router.get("/template")
def download_bulk_template():
    output = io.BytesIO(generate_template_excel())

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Bulk_Upload_Template.xlsx"}
    )
