import os
import sys
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal

def fix_schema():
    db = SessionLocal()
    try:
        print("Fixing CenterTest schema on Supabase...")
        
        # 1. Drop existing table if it exists (since it's empty)
        db.execute(text("DROP TABLE IF EXISTS center_tests CASCADE"))
        db.commit()
        print("Dropped old center_tests table.")
        
        # 2. Recreate table with correct foreign key
        # We can use the Base metadata to create it, but for simplicity we'll use raw SQL here to ensure it's correct
        # or just import the Base and create_all (it will only create missing tables)
        from app.models.entities import Base
        from app.db.session import engine
        Base.metadata.create_all(bind=engine)
        print("Recreated center_tests table with correct foreign key to master_tests.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_schema()
