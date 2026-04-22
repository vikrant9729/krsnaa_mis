from sqlalchemy import text
from app.db.session import engine

def check_columns():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'master_tests'"))
        columns = [r[0] for r in res.fetchall()]
        print(f"Columns in master_tests: {columns}")
        
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'centers'"))
        columns = [r[0] for r in res.fetchall()]
        print(f"Columns in centers: {columns}")

if __name__ == "__main__":
    check_columns()
