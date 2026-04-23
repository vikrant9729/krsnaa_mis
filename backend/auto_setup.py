"""
auto_setup.py
=============
Automatic database setup and migration system.
Runs all necessary migrations, repairs, and optimizations on startup.
This eliminates the need to manually run individual fix scripts.
"""

import sys
import os
from sqlalchemy import text
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from app.models.entities import Base

def check_and_create_tables():
    """Create all tables if they don't exist (like init_supabase.py)"""
    print("\n" + "="*60)
    print("📊 STEP 1: Checking Database Tables")
    print("="*60)
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ All tables verified/created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def check_and_add_columns():
    """Add missing columns to tables (combines multiple migration scripts)"""
    print("\n" + "="*60)
    print("🔧 STEP 2: Checking Database Schema")
    print("="*60)
    
    db = SessionLocal()
    try:
        # 1. Add type and bill_type to centers (migrate_bill_type.py, update_centers_schema.py)
        print("  Checking centers table columns...")
        for col in ['type', 'bill_type']:
            try:
                db.execute(text(f"ALTER TABLE centers ADD COLUMN IF NOT EXISTS {col} VARCHAR(100)"))
                db.commit()
                print(f"    ✅ Column '{col}' verified")
            except Exception as e:
                print(f"    ⚠️  Column '{col}' may already exist: {e}")
        
        # 2. Add custom_mrp and mrp_source to master_tests (add_mrp_columns.py)
        print("  Checking master_tests table columns...")
        for col, col_type in [('custom_mrp', 'FLOAT'), ('mrp_source', 'VARCHAR(100)')]:
            try:
                db.execute(text(f"ALTER TABLE master_tests ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                db.commit()
                print(f"    ✅ Column '{col}' verified")
            except Exception as e:
                print(f"    ⚠️  Column '{col}' may already exist: {e}")
        
        # 3. Add test_code to dos_rows (migrate_dos_test_code.py)
        print("  Checking dos_rows table columns...")
        try:
            db.execute(text("ALTER TABLE dos_rows ADD COLUMN IF NOT EXISTS test_code VARCHAR(100)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_dos_rows_test_code ON dos_rows(test_code)"))
            db.commit()
            print("    ✅ Column 'test_code' and index verified")
        except Exception as e:
            print(f"    ⚠️  Column 'test_code' may already exist: {e}")
        
        # 4. Add temperature and max_tokens to ai_provider_configs (migrate_ai_config.py)
        try:
            db.execute(text("ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7"))
            db.execute(text("ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000"))
            db.commit()
            print("    ✅ AI config columns verified")
        except Exception as e:
            print(f"    ⚠️  AI config columns may already exist: {e}")
        
        # 5. Create special_rate_lists table if not exists (create_special_lists_table.py)
        print("  Checking special_rate_lists table...")
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS special_rate_lists (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    data_json JSON NOT NULL,
                    created_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            db.commit()
            print("    ✅ special_rate_lists table verified")
        except Exception as e:
            print(f"    ⚠️  special_rate_lists table may already exist: {e}")
        
        return True
    except Exception as e:
        print(f"❌ Error checking columns: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def populate_test_codes():
    """Populate test_code column in dos_rows from data_json (migrate_dos_test_code.py)"""
    print("\n" + "="*60)
    print("📝 STEP 3: Populating Test Codes")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Populate missing test_codes
        result = db.execute(text("""
            UPDATE dos_rows 
            SET test_code = UPPER(TRIM(COALESCE(data_json->>'LAB_TestID', data_json->>'Test_Code', '')))
            WHERE test_code IS NULL OR test_code = ''
        """))
        db.commit()
        print(f"✅ Populated {result.rowcount} test_code entries")
        return True
    except Exception as e:
        print(f"❌ Error populating test codes: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def backfill_center_data():
    """Backfill type and bill_type from metadata_json or DOS data (migrate_bill_type.py, update_centers_schema.py)"""
    print("\n" + "="*60)
    print("🔄 STEP 4: Backfilling Center Data")
    print("="*60)
    
    db = SessionLocal()
    try:
        import json
        
        # Get all centers
        centers = db.execute(text("SELECT id, metadata_json FROM centers")).fetchall()
        backfilled = 0
        
        for center_id, metadata in centers:
            if not metadata:
                continue
            
            # Parse metadata if it's a string
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    continue
            
            # Extract type and bill_type
            bill_type = (metadata.get("bill_type") or metadata.get("billType") or 
                        metadata.get("Bill_Type") or metadata.get("BILL_TYPE") or "")
            center_type = (metadata.get("type") or metadata.get("center_type_label") or "")
            
            # If bill_type is empty, use center_type as fallback
            if not bill_type and center_type:
                bill_type = center_type
            
            if center_type or bill_type:
                updates = []
                values = []
                if center_type:
                    updates.append("type = :ctype")
                    values.append(center_type)
                if bill_type:
                    updates.append("bill_type = :btype")
                    values.append(bill_type)
                
                values.append(center_id)
                db.execute(text(f"UPDATE centers SET {', '.join(updates)} WHERE id = :cid"), 
                          {"ctype": center_type, "btype": bill_type, "cid": center_id})
                backfilled += 1
        
        db.commit()
        print(f"✅ Backfilled {backfilled} centers with type/bill_type data")
        return True
    except Exception as e:
        print(f"❌ Error backfilling center data: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def create_admin_user():
    """Create admin user if it doesn't exist (create_admin.py)"""
    print("\n" + "="*60)
    print("👤 STEP 5: Checking Admin User")
    print("="*60)
    
    db = SessionLocal()
    try:
        from app.models.entities import User, RoleEnum
        from app.services.security import hash_password
        
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("✅ Admin user already exists")
            return True
        
        # Create admin user
        admin = User(
            username="admin",
            full_name="Admin User",
            password_hash=hash_password("admin123"),
            role=RoleEnum.ADMIN,
            is_active=True,
        )
        
        db.add(admin)
        db.commit()
        print("✅ Admin user created successfully")
        print("   Username: admin")
        print("   Password: admin123")
        return True
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def optimize_database():
    """Create performance indexes (optimize_db.py)"""
    print("\n" + "="*60)
    print("⚡ STEP 6: Optimizing Database")
    print("="*60)
    
    db = SessionLocal()
    try:
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_dos_rows_dataset_id ON dos_rows(dataset_id)",
            "CREATE INDEX IF NOT EXISTS idx_dos_rows_test_code ON dos_rows ((data_json->>'Test_Code'))",
            "CREATE INDEX IF NOT EXISTS idx_dos_rows_lab_testid ON dos_rows ((data_json->>'LAB_TestID'))",
            "CREATE INDEX IF NOT EXISTS idx_dos_rows_test_name ON dos_rows ((data_json->>'test_name'))",
            "CREATE INDEX IF NOT EXISTS idx_dos_datasets_active_center ON dos_datasets(center_id, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_centers_code ON centers(code)",
            "CREATE INDEX IF NOT EXISTS idx_master_tests_code ON master_tests(test_code)"
        ]
        
        for idx in indexes:
            try:
                db.execute(text(idx))
                db.commit()
            except Exception as e:
                print(f"    ⚠️  Index warning: {str(e)}")
                db.rollback()
        
        print("✅ Database optimization complete")
        return True
    except Exception as e:
        print(f"❌ Error optimizing database: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def repair_center_tests():
    """Repair CenterTest rates from DOS data (repair_mrp.py, sync_local_services.py)"""
    print("\n" + "="*60)
    print("🔨 STEP 7: Repairing Center Test Rates")
    print("="*60)
    
    db = SessionLocal()
    try:
        from app.models.entities import Center, DosDataset, DosRow, CenterTest, MasterTest
        from sqlalchemy import insert
        
        # Get all active datasets
        active_datasets = db.query(DosDataset).filter(DosDataset.is_active == True).all()
        total_synced = 0
        
        for dataset in active_datasets:
            center_id = dataset.center_id
            
            # Get unique tests in this dataset
            rows = db.query(DosRow).filter(DosRow.dataset_id == dataset.id).all()
            unique_tests = {}
            for r in rows:
                data = r.data_json
                t_code = str(data.get("LAB_TestID") or data.get("Test_Code") or "").strip().upper()
                if t_code and t_code not in unique_tests:
                    unique_tests[t_code] = {
                        "rate": float(data.get("Bill_Rate", 0)) if data.get("Bill_Rate") else 0.0
                    }
            
            if not unique_tests:
                continue
            
            # Ensure tests are in MasterTest
            t_codes = list(unique_tests.keys())
            existing_master = {t.LAB_TestID for t in db.query(MasterTest.LAB_TestID).filter(MasterTest.LAB_TestID.in_(t_codes)).all()}
            
            new_master_entries = []
            for code, info in unique_tests.items():
                if code not in existing_master:
                    new_master_entries.append({
                        "LAB_TestID": code,
                        "test_name": "Unknown",
                        "TestCategory_Mapped": "General"
                    })
            
            if new_master_entries:
                db.execute(insert(MasterTest), new_master_entries)
                db.flush()
            
            # Sync to CenterTest
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
                for i in range(0, len(new_center_tests), 1000):
                    db.execute(insert(CenterTest), new_center_tests[i:i+1000])
                total_synced += len(new_center_tests)
        
        db.commit()
        print(f"✅ Repaired/synced {total_synced} center test assignments")
        return True
    except Exception as e:
        print(f"❌ Error repairing center tests: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def run_all_setup():
    """Run all setup steps in order"""
    print("\n" + "="*60)
    print("🚀 KRSNAA MIS - AUTOMATIC DATABASE SETUP")
    print("="*60)
    
    steps = [
        ("Database Tables", check_and_create_tables),
        ("Schema & Columns", check_and_add_columns),
        ("Test Code Population", populate_test_codes),
        ("Center Data Backfill", backfill_center_data),
        ("Admin User", create_admin_user),
        ("Database Optimization", optimize_database),
        ("Center Test Repair", repair_center_tests),
    ]
    
    results = []
    for name, func in steps:
        try:
            success = func()
            results.append((name, success))
        except Exception as e:
            print(f"\n❌ Step '{name}' failed with error: {e}")
            results.append((name, False))
    
    # Print summary
    print("\n" + "="*60)
    print("📋 SETUP SUMMARY")
    print("="*60)
    
    all_success = True
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} - {name}")
        if not success:
            all_success = False
    
    print("="*60)
    if all_success:
        print("🎉 ALL SETUP STEPS COMPLETED SUCCESSFULLY!")
        print("   Your app is ready to use.")
    else:
        print("⚠️  Some steps failed. Check the errors above.")
        print("   The app may still work, but some features could be limited.")
    print("="*60 + "\n")
    
    return all_success

if __name__ == "__main__":
    load_dotenv()
    run_all_setup()
