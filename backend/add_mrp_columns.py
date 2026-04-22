from sqlalchemy import text
from app.db.session import engine

def migrate():
    with engine.connect() as conn:
        print("Starting migration...")
        try:
            # Add custom_mrp to master_tests
            conn.execute(text("ALTER TABLE master_tests ADD COLUMN IF NOT EXISTS custom_mrp FLOAT;"))
            # Add mrp_source to master_tests
            conn.execute(text("ALTER TABLE master_tests ADD COLUMN IF NOT EXISTS mrp_source VARCHAR(100);"))
            conn.commit()
            print("Migration successful: Added custom_mrp and mrp_source to master_tests table.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
