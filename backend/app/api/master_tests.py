from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import MasterTest, User
from app.services.rbac import require_permission

router = APIRouter(prefix="/master-tests", tags=["master-tests"])

@router.get("")
def list_master_tests(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "center:read")
    query = db.query(MasterTest)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MasterTest.LAB_TestID.ilike(search_filter)) | 
            (MasterTest.test_name.ilike(search_filter)) |
            (MasterTest.TestCategory_Mapped.ilike(search_filter))
        )
    
    total = query.count()
    items = query.order_by(MasterTest.LAB_TestID).offset(skip).limit(limit).all()
    
    return {
        "items": items,
        "total": total,
        "pages": (total + limit - 1) // limit,
        "skip": skip,
        "limit": limit
    }

@router.post("")
def create_master_test(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    test = MasterTest(**payload)
    db.add(test)
    db.commit()
    db.refresh(test)
    return test

@router.patch("/{test_id}")
def update_master_test(test_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    test = db.query(MasterTest).filter(MasterTest.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    for k, v in payload.items():
        setattr(test, k, v)
    db.commit()
    db.refresh(test)
    return test

@router.post("/sync-from-dos")
def sync_from_existing_dos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    from app.models.entities import DosRow
    
    # Get all unique Test_Codes from DosRow data_json
    # This is a bit heavy for SQL alone since it's JSON, so we fetch and process
    rows = db.query(DosRow).all()
    new_tests_count = 0
    
    existing_codes = {t.LAB_TestID for t in db.query(MasterTest.LAB_TestID).all()}
    
    for row in rows:
        data = row.data_json
        raw_code = data.get("LAB_TestID") or data.get("Test_Code")
        if raw_code is None:
            continue
            
        code = str(raw_code).strip()
        name = str(data.get("test_name") or data.get("Test_Name") or data.get("Test_Description") or "Unknown Test").strip()
        category = str(data.get("TestCategory_Mapped") or data.get("Category") or data.get("Department") or "General").strip()
        
        if code and code not in existing_codes:
            master_test = MasterTest(
                LAB_TestID=code,
                test_name=name,
                TestCategory_Mapped=category
            )
            db.add(master_test)
            existing_codes.add(code)
            new_tests_count += 1
            
    db.commit()
    return {"status": "success", "synced": new_tests_count}


@router.delete("/all")
def delete_all_master_tests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    db.query(MasterTest).delete()
    db.commit()
    return {"status": "success", "message": "All master tests deleted"}


@router.post("/bulk-delete")
def bulk_delete_master_tests(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    test_ids = payload.get("ids", [])
    if not test_ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    db.query(MasterTest).filter(MasterTest.id.in_(test_ids)).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": f"Deleted {len(test_ids)} tests"}
