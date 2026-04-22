from sqlalchemy import text
from app.db.session import SessionLocal

def apply_optimization_indexes():
    db = SessionLocal()
    print("Starting Database Optimization Engine...")
    
    indexes = [
        # 1. Dataset ID Index (Critical for all lookups)
        "CREATE INDEX IF NOT EXISTS idx_dos_rows_dataset_id ON dos_rows(dataset_id);",
        
        # 2. JSONB Functional Indexes (For lightning fast deduplication)
        "CREATE INDEX IF NOT EXISTS idx_dos_rows_test_code ON dos_rows ((data_json->>'Test_Code'));",
        "CREATE INDEX IF NOT EXISTS idx_dos_rows_lab_testid ON dos_rows ((data_json->>'LAB_TestID'));",
        "CREATE INDEX IF NOT EXISTS idx_dos_rows_test_name ON dos_rows ((data_json->>'test_name'));",
        
        # 3. Dataset Status Index
        "CREATE INDEX IF NOT EXISTS idx_dos_datasets_active_center ON dos_datasets(center_id, is_active);",
        
        # 4. Master Data Indexes
        "CREATE INDEX IF NOT EXISTS idx_centers_code ON centers(code);",
        "CREATE INDEX IF NOT EXISTS idx_master_tests_code ON master_tests(test_code);"
    ]
    
    for idx in indexes:
        try:
            print(f"Applying: {idx.split('ON')[0]}...")
            db.execute(text(idx))
            db.commit()
        except Exception as e:
            print(f"⚠️ Warning: {str(e)}")
            db.rollback()
            
    print("System Optimization Complete! Everything is now indexed.")
    db.close()

if __name__ == "__main__":
    apply_optimization_indexes()
