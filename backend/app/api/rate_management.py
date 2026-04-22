from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd
import io
import json

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, Center, CenterTest, MasterTest, DosDataset, DosRow, SpecialRateList
from app.services.rbac import require_permission
from app.services.rate_update import apply_percentage_update

router = APIRouter(prefix="/rate-management", tags=["rate-management"])

@router.post("/bulk-center-update")
async def bulk_center_rate_update(
    center_ids: str = Form(...), # JSON array string
    file: UploadFile = File(...),
    save_list: bool = Form(False),
    list_name: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "rate:update")
    
    try:
        ids = json.loads(center_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid center_ids format. Expected JSON array.")

    # 1. Parse the special list
    content = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Normalize columns
    df.columns = [c.strip().lower() for c in df.columns]
    
    code_col = next((c for c in df.columns if 'code' in c or 'id' in c), None)
    rate_col = next((c for c in df.columns if 'rate' in c or 'mrp' in c or 'price' in c), None)
    
    if not code_col or not rate_col:
        raise HTTPException(status_code=400, detail=f"Required columns (Code, Rate) not found. Found: {list(df.columns)}")

    updates = {}
    for _, row in df.iterrows():
        code = str(row[code_col]).strip().upper()
        try:
            rate = float(row[rate_col])
            updates[code] = rate
        except (ValueError, TypeError):
            continue

    if not updates:
        return {"message": "No valid updates found in file"}

    # 1.5 Save list if requested
    if save_list and list_name:
        new_list = SpecialRateList(
            name=list_name,
            data_json=updates,
            created_by=current_user.id
        )
        db.add(new_list)
        db.flush()

    total_centers_processed = 0
    total_rows_updated = 0
    
    # 2. Process each center
    # Pre-map master tests once
    codes = list(updates.keys())
    master_tests = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(codes)).all()
    master_map = {mt.LAB_TestID: mt.id for mt in master_tests}
    
    for center_id in ids:
        # Update CenterTest table in batch
        cts = db.query(CenterTest).filter(
            CenterTest.center_id == center_id,
            CenterTest.test_id.in_(master_map.values())
        ).all()
        
        for ct in cts:
            # Find the code for this master_id
            t_code = next((code for code, mid in master_map.items() if mid == ct.test_id), None)
            if t_code:
                ct.custom_rate = updates[t_code]
                total_rows_updated += 1
                
        # 2.1 Update Master MRP if this is a BASE CENTER
        center_info = db.query(Center).filter(Center.id == center_id).first()
        if center_info and center_info.is_base_center:
            for t_code, new_rate in updates.items():
                db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).update({
                    "custom_mrp": new_rate,
                    "mrp_source": center_info.name
                }, synchronize_session=False)

        # Update DosRow table using optimized targeted search
        active_ds = db.query(DosDataset).filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active == True
        ).first()
        
        if active_ds:
            # Fetch only rows that match our update codes using the new INDEXED COLUMN
            rows = db.query(DosRow).filter(
                DosRow.dataset_id == active_ds.id,
                DosRow.test_code.in_(codes)
            ).all()
            
            for row in rows:
                t_code = str(row.data_json.get("LAB_TestID") or row.data_json.get("Test_Code") or "").strip().upper()
                if t_code in updates:
                    new_data = row.data_json.copy()
                    rate_key = next((k for k in new_data.keys() if k.lower() in ['bill_rate', 'rate', 'mrp', 'price']), 'Bill_Rate')
                    new_data[rate_key] = updates[t_code]
                    row.data_json = new_data
                    
        total_centers_processed += 1

    db.commit()
    
    return {
        "status": "success",
        "centers_processed": total_centers_processed,
        "total_updates": total_rows_updated,
        "message": f"Successfully updated {total_rows_updated} test rates across {total_centers_processed} centers."
    }

@router.post("/category-update")
def update_by_category(
    center_id: int,
    category: str,
    update_type: str, # 'percentage' or 'fixed'
    value: float,
    test_code: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "rate:update")
    
    active_ds = db.query(DosDataset).filter(
        DosDataset.center_id == center_id,
        DosDataset.is_active == True
    ).first()
    
    if not active_ds:
        raise HTTPException(status_code=404, detail="No active dataset found for this center")

    rows = db.query(DosRow).filter(DosRow.dataset_id == active_ds.id).all()
    updated_count = 0
    
    for row in rows:
        row_cat = str(row.data_json.get("TestCategory_Mapped") or row.data_json.get("Category") or "").strip()
        row_code = str(row.data_json.get("LAB_TestID") or row.data_json.get("Test_Code") or "").strip().upper()

        # Filter by category and optionally by test_code
        if row_cat.lower() == category.lower():
            if test_code and row_code != test_code.upper():
                continue
                
            new_data = row.data_json.copy()
            rate_key = next((k for k in new_data.keys() if k.lower() in ['bill_rate', 'rate', 'mrp', 'price']), 'Bill_Rate')
            
            try:
                current_rate = float(new_data.get(rate_key, 0))
            except (ValueError, TypeError):
                current_rate = 0
                
            if update_type == 'percentage':
                new_rate = round(current_rate * (1 + value / 100), 2)
            else:
                new_rate = value
                
            new_data[rate_key] = new_rate
            row.data_json = new_data
            
            # Also update CenterTest
            t_code = str(new_data.get("LAB_TestID") or new_data.get("Test_Code") or "").strip().upper()
            if t_code:
                mt = db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).first()
                if mt:
                    ct = db.query(CenterTest).filter(
                        CenterTest.center_id == center_id,
                        CenterTest.test_id == mt.id
                    ).first()
                    if ct:
                        ct.custom_rate = new_rate
            
            updated_count += 1

    db.commit()
    return {"status": "success", "updated_count": updated_count}

@router.get("/special-lists")
def get_special_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "rate:read")
    return db.query(SpecialRateList).order_by(SpecialRateList.created_at.desc()).all()

@router.post("/apply-saved-list")
def apply_saved_list(
    list_id: int,
    center_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "rate:update")
    
    special_list = db.query(SpecialRateList).filter(SpecialRateList.id == list_id).first()
    if not special_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    updates = special_list.data_json
    total_centers_processed = 0
    total_rows_updated = 0
    
    # Pre-map master tests once
    codes = list(updates.keys())
    master_tests = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(codes)).all()
    master_map = {mt.LAB_TestID: mt.id for mt in master_tests}

    for center_id in center_ids:
        # Update CenterTest table in batch
        cts = db.query(CenterTest).filter(
            CenterTest.center_id == center_id,
            CenterTest.test_id.in_(master_map.values())
        ).all()
        
        for ct in cts:
            t_code = next((code for code, mid in master_map.items() if mid == ct.test_id), None)
            if t_code:
                ct.custom_rate = updates[t_code]
                total_rows_updated += 1
                
        # Update Master MRP if this is a BASE CENTER
        center_info = db.query(Center).filter(Center.id == center_id).first()
        if center_info and center_info.is_base_center:
            for t_code, new_rate in updates.items():
                db.query(MasterTest).filter(MasterTest.LAB_TestID == t_code).update({
                    "custom_mrp": new_rate,
                    "mrp_source": center_info.name
                }, synchronize_session=False)

        # Update DosRow
        active_ds = db.query(DosDataset).filter(
            DosDataset.center_id == center_id,
            DosDataset.is_active == True
        ).first()
        
        if active_ds:
            rows = db.query(DosRow).filter(
                DosRow.dataset_id == active_ds.id,
                DosRow.test_code.in_(codes)
            ).all()
            for row in rows:
                t_code = str(row.data_json.get("LAB_TestID") or row.data_json.get("Test_Code") or "").strip().upper()
                if t_code in updates:
                    new_data = row.data_json.copy()
                    rate_key = next((k for k in new_data.keys() if k.lower() in ['bill_rate', 'rate', 'mrp', 'price']), 'Bill_Rate')
                    new_data[rate_key] = updates[t_code]
                    row.data_json = new_data
                    
        total_centers_processed += 1

    db.commit()
    return {
        "status": "success",
        "centers_processed": total_centers_processed,
        "total_updates": total_rows_updated,
        "message": f"Successfully applied '{special_list.name}' to {total_centers_processed} centers."
    }
