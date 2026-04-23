import sqlite3

DB_PATH = "backend/krsnaa.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Check if bill_type is empty and type has data
    cur.execute("SELECT id, type, bill_type FROM centers WHERE (bill_type IS NULL OR bill_type = '') AND (type IS NOT NULL AND type != '')")
    rows = cur.fetchall()
    print(f"Found {len(rows)} rows to update")
    
    for row in rows:
        cid, t, bt = row
        cur.execute("UPDATE centers SET bill_type = ? WHERE id = ?", (t, cid))
    
    conn.commit()
    conn.close()
    print("Done")

if __name__ == "__main__":
    main()
