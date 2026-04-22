import os
import sys
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal

def check_supabase():
    db = SessionLocal()
    try:
        tables = ["centers", "dos_rows", "master_tests", "dos_datasets", "center_tests", "tests"]
        for table in tables:
            try:
                res = db.execute(text(f"SELECT count(*) FROM {table}"))
                count = res.scalar()
                print(f"Table {table}: {count} rows")
            except Exception as e:
                print(f"Error querying {table}: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_supabase()
