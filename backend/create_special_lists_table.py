from app.db.session import engine
from sqlalchemy import text

def create_table():
    with engine.connect() as conn:
        print("Creating special_rate_lists table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS special_rate_lists (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    data_json JSON NOT NULL,
                    created_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            print("Table created successfully.")
        except Exception as e:
            print(f"Error: {e}")
            conn.rollback()

if __name__ == "__main__":
    create_table()
