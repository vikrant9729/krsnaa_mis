from app.db.session import SessionLocal
from app.models.entities import Center, DosDataset, DosRow, CenterTest, MasterTest
from sqlalchemy import func

def repair():
    db = SessionLocal()
    try:
        # 1. Find HR HISAR center
        hr_hisar = db.query(Center).filter(
            (Center.name.ilike("%HR HISAR%")) | (Center.center_code.ilike("%HISAR%"))
        ).first()
        
        if not hr_hisar:
            print("HR HISAR center not found.")
            return

        print(f"Repairing rates for center: {hr_hisar.name} (ID: {hr_hisar.id})")
        
        # 2. Get active dataset for HR HISAR
        dataset = db.query(DosDataset).filter(
            DosDataset.center_id == hr_hisar.id,
            DosDataset.is_active == True
        ).first()
        
        if not dataset:
            print("No active dataset found for HR HISAR.")
            return
            
        # 3. Get all rows from the dataset
        rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
        print(f"Found {len(rows)} rows in active dataset.")
        
        # 4. Map test codes to rates
        code_to_rate = {}
        for row in rows:
            data = row.data_json
            code = str(data.get("LAB_TestID") or data.get("Test_Code") or "").strip().upper()
            rate = float(data.get("Bill_Rate", 0)) if data.get("Bill_Rate") else 0.0
            if code:
                code_to_rate[code] = rate
                
        # 5. Update CenterTest records
        # First, get master tests to map codes to IDs
        all_master = db.query(MasterTest).all()
        master_map = {t.LAB_TestID.upper(): t.id for t in all_master if t.LAB_TestID}
        
        updated_count = 0
        new_count = 0
        
        for code, rate in code_to_rate.items():
            master_id = master_map.get(code)
            if not master_id:
                continue
                
            # Check for existing CenterTest
            ct = db.query(CenterTest).filter(
                CenterTest.center_id == hr_hisar.id,
                CenterTest.test_id == master_id
            ).first()
            
            if ct:
                if ct.custom_rate != rate:
                    ct.custom_rate = rate
                    updated_count += 1
            else:
                new_ct = CenterTest(
                    center_id=hr_hisar.id,
                    test_id=master_id,
                    custom_rate=rate
                )
                db.add(new_ct)
                new_count += 1
                
        db.commit()
        print(f"Success: Updated {updated_count} rates, added {new_count} new assignments.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during repair: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    repair()
