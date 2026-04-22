from app.db.session import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Adding test_code column to dos_rows...")
        try:
            conn.execute(text("ALTER TABLE dos_rows ADD COLUMN IF NOT EXISTS test_code VARCHAR(100)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dos_rows_test_code ON dos_rows(test_code)"))
            conn.commit()
            print("Column added. Populating test_code from data_json...")
            
            # This might take time if there are many rows
            # Optimized for Postgres:
            conn.execute(text("""
                UPDATE dos_rows 
                SET test_code = UPPER(TRIM(COALESCE(data_json->>'LAB_TestID', data_json->>'Test_Code')))
                WHERE test_code IS NULL
            """))
            conn.commit()
            print("Migration completed successfully.")
        except Exception as e:
            print(f"Error: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate()
