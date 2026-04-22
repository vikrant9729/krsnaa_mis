from sqlalchemy import text
from app.db.session import engine

def migrate():
    with engine.connect() as conn:
        print("Adding columns to ai_provider_configs...")
        try:
            conn.execute(text("ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7"))
            conn.execute(text("ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000"))
            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
