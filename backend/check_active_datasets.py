import sqlite3
import os

db_path = r"c:\ACCOUNT-MAIN\KRSNAA\mis app\krsnaa-mis-software-main\krsnaa-mis-software-main\backend\krsnaa.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT count(*) FROM dos_datasets WHERE is_active = 1")
    active_count = cursor.fetchone()[0]
    print(f"Active datasets: {active_count}")
    
    cursor.execute("SELECT count(*) FROM dos_datasets WHERE is_active = 0")
    inactive_count = cursor.fetchone()[0]
    print(f"Inactive datasets: {inactive_count}")
    
    conn.close()
