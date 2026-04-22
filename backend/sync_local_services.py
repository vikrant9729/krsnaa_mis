import os
import sys
from sqlalchemy import insert, func
from collections import defaultdict

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.entities import Center, DosDataset, DosRow, MasterTest, CenterTest

def sync_local_services():
    db = SessionLocal()
    try:
        print("Starting Sync of Local Services from DOS data...")
        
        # 1. Get all active datasets
        active_datasets = db.query(DosDataset).filter(DosDataset.is_active == True).all()
        print(f"Found {len(active_datasets)} active datasets.")
        
        total_synced = 0
        
        for dataset in active_datasets:
            center_id = dataset.center_id
            print(f"Processing Center ID: {center_id}...", end=" ", flush=True)
            
            # 2. Get unique tests in this dataset
            rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
            unique_tests = {}
            for r in rows:
                data = r.data_json
                t_code = str(data.get("LAB_TestID") or data.get("Test_Code") or "").strip().upper()
                if t_code and t_code not in unique_tests:
                    unique_tests[t_code] = {
                        "name": str(data.get("test_name") or data.get("Test_Name") or "Unknown").strip(),
                        "category": str(data.get("TestCategory_Mapped") or data.get("Category") or "General").strip(),
                        "rate": float(data.get("Bill_Rate", 0)) if data.get("Bill_Rate") else 0.0
                    }
            
            if not unique_tests:
                print("No tests found.")
                continue
                
            # 3. Ensure they are in MasterTest
            t_codes = list(unique_tests.keys())
            existing_master = {t.LAB_TestID for t in db.query(MasterTest.LAB_TestID).filter(MasterTest.LAB_TestID.in_(t_codes)).all()}
            
            new_master_entries = []
            for code, info in unique_tests.items():
                if code not in existing_master:
                    new_master_entries.append({
                        "LAB_TestID": code,
                        "test_name": info["name"],
                        "TestCategory_Mapped": info["category"]
                    })
            
            if new_master_entries:
                db.execute(insert(MasterTest), new_master_entries)
                db.flush()
                
            # 4. Sync to CenterTest
            # Refresh master test map to get IDs
            all_master = db.query(MasterTest).filter(MasterTest.LAB_TestID.in_(t_codes)).all()
            master_map = {t.LAB_TestID: t.id for t in all_master}
            
            existing_center_tests = {ct.test_id for ct in db.query(CenterTest.test_id).filter(CenterTest.center_id == center_id).all()}
            
            new_center_tests = []
            for code, master_id in master_map.items():
                if master_id not in existing_center_tests:
                    new_center_tests.append({
                        "center_id": center_id,
                        "test_id": master_id,
                        "custom_rate": unique_tests[code]["rate"]
                    })
            
            if new_center_tests:
                # Batch insert center tests (limit 1000 per call for SQLite)
                for i in range(0, len(new_center_tests), 1000):
                    db.execute(insert(CenterTest), new_center_tests[i:i+1000])
                total_synced += len(new_center_tests)
                print(f"Synced {len(new_center_tests)} tests.")
            else:
                print("Already up to date.")
            
            db.commit()
            
        print(f"\nSync complete! Total {total_synced} local service assignments created.")
        
    except Exception as e:
        print(f"\nError during sync: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_local_services()
