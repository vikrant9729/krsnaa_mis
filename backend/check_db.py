import sqlite3
import os

db_path = r"c:\ACCOUNT-MAIN\KRSNAA\mis app\krsnaa-mis-software-main\krsnaa-mis-software-main\backend\krsnaa.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables = ["centers", "dos_rows", "master_tests", "dos_datasets"]
    for table in tables:
        try:
            cursor.execute(f"SELECT count(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Table {table}: {count} rows")
        except Exception as e:
            print(f"Error querying {table}: {e}")
    
    conn.close()
