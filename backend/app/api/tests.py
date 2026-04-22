from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import MasterTest, CenterTest, Center, User
from app.schemas.common import TestCreate, TestOut, TestUpdate, CenterTestCreate, CenterTestOut
from app.services.audit import log_change
from app.services.rbac import require_permission

router = APIRouter(prefix="/tests", tags=["tests"])


@router.post("", response_model=TestOut)
def create_test(
    payload: TestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    # Check if code already exists
    # Note: Test model still uses .code, but Center uses .center_code
    # If the user wants Test to use LAB_TestID too, I should check that.
    # For now, only Center was renamed to center_code.
    existing = db.query(Test).filter(Test.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Test code already exists")

    test = Test(**payload.model_dump())
    db.add(test)
    db.commit()
    db.refresh(test)

    log_change(
        db,
        entity_type="test",
        entity_id=str(test.id),
        action="CREATE",
        old_value=None,
        new_value=payload.model_dump(),
        actor_id=current_user.id,
    )
    return test


from app.schemas.common import MasterTestOut

@router.get("", response_model=list[MasterTestOut])
def list_tests(
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:read")

    query = db.query(MasterTest)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                MasterTest.LAB_TestID.ilike(search_filter), 
                MasterTest.test_name.ilike(search_filter)
            )
        )
    return query.all()


@router.get("/{test_id}", response_model=TestOut)
def get_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:read")

    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.put("/{test_id}", response_model=TestOut)
def update_test(
    test_id: int,
    payload: TestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    old_value = {
        "code": test.code,
        "name": test.name,
        "rate": test.rate,
        "description": test.description,
        "is_active": test.is_active,
    }

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(test, key, value)

    db.commit()
    db.refresh(test)

    log_change(
        db,
        entity_type="test",
        entity_id=str(test.id),
        action="UPDATE",
        old_value=old_value,
        new_value=payload.model_dump(exclude_unset=True),
        actor_id=current_user.id,
    )
    return test


@router.delete("/{test_id}")
def delete_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Check if test is used in any center
    center_test = db.query(CenterTest).filter(CenterTest.test_id == test_id).first()
    if center_test:
        raise HTTPException(status_code=400, detail="Cannot delete test that is assigned to centers")

    old_value = {
        "code": test.code,
        "name": test.name,
        "rate": test.rate,
        "description": test.description,
        "is_active": test.is_active,
    }

    db.delete(test)
    db.commit()

    log_change(
        db,
        entity_type="test",
        entity_id=str(test_id),
        action="DELETE",
        old_value=old_value,
        new_value=None,
        actor_id=current_user.id,
    )
    return {"message": "Test deleted"}


@router.post("/centers", response_model=CenterTestOut)
def add_test_to_center(
    payload: CenterTestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    # Check if center exists
    center = db.query(Center).filter(Center.id == payload.center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    # Check if test exists
    test = db.query(MasterTest).filter(MasterTest.id == payload.test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Check if already assigned
    existing = db.query(CenterTest).filter(
        CenterTest.center_id == payload.center_id,
        CenterTest.test_id == payload.test_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Test already assigned to this center")

    center_test = CenterTest(**payload.model_dump())
    db.add(center_test)
    db.commit()
    db.refresh(center_test)

    # Load the test for response
    db.refresh(center_test)
    center_test.test = test

    log_change(
        db,
        entity_type="center_test",
        entity_id=str(center_test.id),
        action="CREATE",
        old_value=None,
        new_value=payload.model_dump(),
        actor_id=current_user.id,
    )
    return center_test


@router.get("/centers/{center_id}", response_model=list[CenterTestOut])
def get_center_tests(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:read")

    center = db.query(Center).filter(Center.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    from app.models.entities import DosDataset, DosRow
    from sqlalchemy import func

    # Fetch center tests with their linked master tests
    cts = (
        db.query(CenterTest)
        .options(joinedload(CenterTest.test))
        .filter(CenterTest.center_id == center_id)
        .all()
    )

    # Get active DOS dataset for fallback rates
    active_ds = db.query(DosDataset).filter(
        DosDataset.center_id == center_id,
        DosDataset.is_active == True
    ).first()

    dos_rates = {}
    if active_ds:
        # Build a map of UPPER(LAB_TestID) -> Bill_Rate from DOS rows
        dos_rows = db.query(DosRow).filter(DosRow.dataset_id == active_ds.id).all()
        for row in dos_rows:
            raw_code = row.data_json.get("LAB_TestID") or row.data_json.get("Test_Code") or ""
            code = str(raw_code).strip().upper()
            rate_val = row.data_json.get("Bill_Rate") or row.data_json.get("Rate") or row.data_json.get("MRP") or 0
            try:
                dos_rates[code] = float(rate_val)
            except (ValueError, TypeError):
                dos_rates[code] = 0.0

    # Enrich: if custom_rate is 0 or None, fall back to DOS rate
    for ct in cts:
        if (ct.custom_rate is None or ct.custom_rate == 0) and ct.test:
            test_code = str(ct.test.LAB_TestID or "").strip().upper()
            if test_code in dos_rates and dos_rates[test_code] > 0:
                ct.custom_rate = dos_rates[test_code]

    return cts


@router.delete("/centers/{center_test_id}")
def remove_test_from_center(
    center_test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    center_test = db.query(CenterTest).filter(CenterTest.id == center_test_id).first()
    if not center_test:
        raise HTTPException(status_code=404, detail="Center test assignment not found")

    old_value = {
        "center_id": center_test.center_id,
        "test_id": center_test.test_id,
        "custom_rate": center_test.custom_rate,
    }

    db.delete(center_test)
    db.commit()

    log_change(
        db,
        entity_type="center_test",
        entity_id=str(center_test_id),
        action="DELETE",
        old_value=old_value,
        new_value=None,
        actor_id=current_user.id,
    )
    return {"message": "Test removed from center"}


@router.put("/centers/{center_test_id}/rate")
def update_center_test_rate(
    center_test_id: int,
    custom_rate: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "test:write")

    center_test = db.query(CenterTest).filter(CenterTest.id == center_test_id).first()
    if not center_test:
        raise HTTPException(status_code=404, detail="Center test assignment not found")

    old_value = {"custom_rate": center_test.custom_rate}

    center_test.custom_rate = custom_rate
    db.commit()

    log_change(
        db,
        entity_type="center_test",
        entity_id=str(center_test_id),
        action="UPDATE",
        old_value=old_value,
        new_value={"custom_rate": custom_rate},
        actor_id=current_user.id,
    )
    return {"message": "Rate updated"}