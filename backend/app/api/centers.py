from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Center, CenterTypeEnum, User
from app.schemas.common import CenterCreate, CenterOut
from app.services.audit import log_change
from app.services.rbac import require_permission

router = APIRouter(prefix="/centers", tags=["centers"])


@router.post("", response_model=CenterOut)
def create_center(
    payload: CenterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")

    if payload.center_type == CenterTypeEnum.HLM and payload.parent_id is not None:
        raise HTTPException(status_code=400, detail="HLM cannot have parent")

    if payload.center_type == CenterTypeEnum.CC and payload.parent_id is None:
        raise HTTPException(status_code=400, detail="CC must have HLM parent")

    if payload.center_type == CenterTypeEnum.PROJECT and payload.parent_id is None:
        raise HTTPException(status_code=400, detail="PROJECT must have CC parent")

    center = Center(**payload.model_dump())
    db.add(center)
    db.commit()
    db.refresh(center)

    log_change(
        db,
        entity_type="center",
        entity_id=str(center.id),
        action="CREATE",
        old_value=None,
        new_value=payload.model_dump(),
        actor_id=current_user.id,
    )
    return center


@router.get("", response_model=list[CenterOut])
def list_centers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:read")
    return db.query(Center).order_by(Center.id.asc()).all()


@router.get("/{center_id}", response_model=CenterOut)
def get_center(center_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:read")
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    return center



@router.patch("/{center_id}", response_model=CenterOut)
def update_center(
    center_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    old_value = {
        "name": center.name,
        "center_code": center.center_code,
        "center_type": center.center_type,
        "parent_id": center.parent_id,
    }

    if "name" in payload:
        center.name = payload["name"]
    if "center_code" in payload:
        center.center_code = payload["center_code"]
    if "center_type" in payload:
        center.center_type = payload["center_type"]
    if "parent_id" in payload:
        center.parent_id = payload["parent_id"]
    if "metadata_json" in payload:
        center.metadata_json = payload["metadata_json"]

    # Simple validation for the new hierarchy
    if center.center_type == CenterTypeEnum.HLM and center.parent_id is not None:
         raise HTTPException(status_code=400, detail="HLM cannot have parent")

    db.commit()
    db.refresh(center)

    log_change(
        db,
        entity_type="center",
        entity_id=str(center.id),
        action="UPDATE",
        old_value=old_value,
        new_value=payload,
        actor_id=current_user.id,
    )
    return center


@router.delete("/{center_id}")
def delete_center(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "center:write")
    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    # TODO: Check if center has children and prevent deletion or cascade?
    # For now, allow deletion and let DB foreign keys handle it or just cascade.
    
    old_value = {
        "name": center.name,
        "center_code": center.center_code,
    }

    db.delete(center)
    db.commit()

    log_change(
        db,
        entity_type="center",
        entity_id=str(center_id),
        action="DELETE",
        old_value=old_value,
        new_value=None,
        actor_id=current_user.id,
    )
    return {"status": "success", "message": "Center deleted"}


@router.delete("/all/confirm")
def delete_all_centers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    from app.models.entities import DosRow, DosDataset, DOSVersionSnapshot, AISuggestion, CenterTest, UserCenterAssignment
    
    try:
        # 1. Nullify self-references
        db.query(Center).update({"parent_id": None, "base_center_id": None})
        db.flush()
        
        # 2. Delete child records
        db.query(DosRow).delete()
        db.query(DosDataset).delete()
        db.query(DOSVersionSnapshot).delete()
        db.query(AISuggestion).delete()
        db.query(UserCenterAssignment).delete()
        db.query(CenterTest).delete()
        
        # 3. Delete centers
        db.query(Center).delete()
        db.commit()
        return {"status": "success", "message": "All centers and related data deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Deep delete failed: {str(e)}")


@router.post("/bulk-delete")
def bulk_delete_centers(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    from app.models.entities import DosRow, DosDataset, DOSVersionSnapshot, AISuggestion, CenterTest, UserCenterAssignment
    
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    try:
        # 1. Nullify self-references for these IDs
        db.query(Center).filter(Center.id.in_(ids)).update({"parent_id": None, "base_center_id": None}, synchronize_session=False)
        
        # 2. Find associated datasets to delete their rows
        dataset_ids = [d.id for d in db.query(DosDataset.id).filter(DosDataset.center_id.in_(ids)).all()]
        if dataset_ids:
            db.query(DosRow).filter(DosRow.dataset_id.in_(dataset_ids)).delete(synchronize_session=False)
            db.query(DOSVersionSnapshot).filter(DOSVersionSnapshot.dataset_id.in_(dataset_ids)).delete(synchronize_session=False)
        
        # 3. Delete other dependencies
        db.query(DosDataset).filter(DosDataset.center_id.in_(ids)).delete(synchronize_session=False)
        db.query(AISuggestion).filter(AISuggestion.center_id.in_(ids)).delete(synchronize_session=False)
        db.query(UserCenterAssignment).filter(UserCenterAssignment.center_id.in_(ids)).delete(synchronize_session=False)
        db.query(CenterTest).filter(CenterTest.center_id.in_(ids)).delete(synchronize_session=False)
        
        # 4. Finally delete the centers
        db.query(Center).filter(Center.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "message": f"Deleted {len(ids)} centers and related data"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")
