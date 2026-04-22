from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import MasterTest, User
from app.services.rbac import require_permission
from app.schemas.common import MasterTestOut, MasterTestListOut

router = APIRouter(prefix="/master-tests", tags=["master-tests"])

@router.get("", response_model=MasterTestListOut)
def list_master_tests(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    category: str = None,
    mrp_source: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "center:read")
    from app.models.entities import Center, CenterTest
    from sqlalchemy import func, case, desc, and_, or_
    
    # 1. Base Query
    query = db.query(MasterTest)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                MasterTest.LAB_TestID.ilike(search_filter), 
                MasterTest.test_name.ilike(search_filter),
                MasterTest.TestCategory_Mapped.ilike(search_filter)
            )
        )
        
    if category and category != "All":
        query = query.filter(MasterTest.TestCategory_Mapped == category)
        
    # MRP Source Filter is tricky in SQL because it's dynamic.
    # For now, we'll handle the basic filters in SQL and the complex ones in post-processing 
    # OR if mrp_source is 'MANUAL', we can filter in SQL.
    if mrp_source == "MANUAL":
        query = query.filter(MasterTest.custom_mrp != None)
    
    total = query.count()
    # We fetch more if mrp_source filter is applied to find enough items for the limit, 
    # but for simplicity we fetch and then filter. 
    # Better: fetch all for the current search/category, enrich, then filter, then paginate.
    if mrp_source and mrp_source != "All" and mrp_source != "MANUAL":
        # Fetch all filtered by other criteria to apply source filter
        all_items = query.order_by(MasterTest.LAB_TestID).all()
    else:
        all_items = query.order_by(MasterTest.LAB_TestID).offset(skip).limit(limit).all()
    
    # 2. Enrich with MRP logic
    hr_hisar = db.query(Center).filter(
        (Center.name.ilike("%HR HISAR%")) | (Center.center_code.ilike("%HISAR%"))
    ).first()

    # 2. Enrich with MRP logic (OPTIMIZED: No N+1 queries)
    test_ids = [t.id for t in all_items]
    
    # Pre-fetch ALL relevant CenterTests for these tests
    all_cts = db.query(CenterTest, Center.name).join(Center).filter(
        CenterTest.test_id.in_(test_ids)
    ).all()
    
    # Group CTS by test_id
    cts_by_test = {}
    for ct, center_name in all_cts:
        if ct.test_id not in cts_by_test:
            cts_by_test[ct.test_id] = []
        cts_by_test[ct.test_id].append({"rate": ct.custom_rate, "center": center_name})

    results = []
    for test in all_items:
        if test.custom_mrp is not None:
            test.mrp = test.custom_mrp
            test.mrp_source_center = test.mrp_source or "MANUAL"
        else:
            mrp = 0.0
            source_center = "N/A"
            
            # Find in our pre-fetched data
            test_rates = cts_by_test.get(test.id, [])
            if test_rates:
                # Find HR HISAR first if exists
                hisar_rate = next((r for r in test_rates if "HR HISAR" in r["center"].upper()), None)
                if hisar_rate:
                    mrp = hisar_rate["rate"]
                    source_center = hisar_rate["center"]
                else:
                    # Fallback to max rate
                    max_rate_obj = max(test_rates, key=lambda x: x["rate"])
                    mrp = max_rate_obj["rate"]
                    source_center = max_rate_obj["center"]
            
            test.mrp = mrp
            test.mrp_source_center = source_center
            
        # Apply mrp_source filter if specified
        if mrp_source and mrp_source != "All":
            if test.mrp_source_center != mrp_source:
                continue
        
        results.append(test)
    
    # If we filtered by mrp_source, we need to manually paginate
    if mrp_source and mrp_source != "All":
        total_filtered = len(results)
        results = results[skip : skip + limit]
        return {
            "items": results,
            "total": total_filtered,
            "pages": (total_filtered + limit - 1) // limit if limit > 0 else 1,
            "skip": skip,
            "limit": limit
        }
    
    return {
        "items": results,
        "total": total,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "skip": skip,
        "limit": limit
    }

@router.get("/filters")
def get_master_test_filters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:read")
    from app.models.entities import Center, CenterTest
    
    # Get unique categories
    categories = db.query(MasterTest.TestCategory_Mapped).distinct().all()
    categories = [c[0] for c in categories if c[0]]
    
    # Get unique source centers (those having CenterTest records)
    sources = db.query(Center.name).join(CenterTest).distinct().all()
    sources = [s[0] for s in sources]
    if "HR HISAR" not in sources:
        sources.append("HR HISAR")
    sources.append("MANUAL")
    sources.append("N/A")
    
    return {
        "categories": ["All"] + sorted(categories),
        "sources": ["All"] + sorted(sources)
    }

@router.get("/{test_id}", response_model=MasterTestOut)
def get_master_test(test_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:read")
    from app.models.entities import Center, CenterTest
    from sqlalchemy import desc
    
    test = db.query(MasterTest).filter(MasterTest.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    # Check for Custom MRP first
    if test.custom_mrp is not None:
        test.mrp = test.custom_mrp
        test.mrp_source_center = test.mrp_source or "MANUAL"
    else:
        # Calculate MRP
        hr_hisar = db.query(Center).filter(
            (Center.name.ilike("%HR HISAR%")) | (Center.center_code.ilike("%HISAR%"))
        ).first()

        mrp = None
        source_center = "HR HISAR"
        
        if hr_hisar:
            ct_hisar = db.query(CenterTest).filter(
                CenterTest.test_id == test.id,
                CenterTest.center_id == hr_hisar.id
            ).first()
            if ct_hisar:
                mrp = ct_hisar.custom_rate
        
        if mrp is None:
            max_ct = db.query(CenterTest, Center.name).join(Center).filter(
                CenterTest.test_id == test.id
            ).order_by(desc(CenterTest.custom_rate)).first()
            
            if max_ct:
                mrp = max_ct[0].custom_rate
                source_center = max_ct[1]
            else:
                mrp = 0.0
                source_center = "N/A"

        test.mrp = mrp
        test.mrp_source_center = source_center
        
    return test

@router.post("")
def create_master_test(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    if payload.get("custom_mrp") is not None and not payload.get("mrp_source"):
        payload["mrp_source"] = "MANUAL"
        
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
        
    if payload.get("custom_mrp") is not None and not payload.get("mrp_source"):
        payload["mrp_source"] = "MANUAL"
    elif payload.get("custom_mrp") is None and "custom_mrp" in payload:
        payload["mrp_source"] = None
        
    for k, v in payload.items():
        setattr(test, k, v)
    db.commit()
    db.refresh(test)
    return test

@router.post("/sync-from-dos")
def sync_from_existing_dos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, "center:write")
    from app.models.entities import DosRow
    
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
