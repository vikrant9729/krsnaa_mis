import os
import json
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')
DATABASE_URL = os.getenv('DATABASE_URL')

def column_exists(cur, table, column):
    cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' AND column_name='{column}'")
    return cur.fetchone() is not None

def main():
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env")
        return

    print(f"Connecting to Supabase...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # --- 1. Add missing columns if needed ---
    # In Postgres, ALTER TABLE ... ADD COLUMN IF NOT EXISTS is supported in newer versions.
    if not column_exists(cur, "centers", "type"):
        print("Adding column 'type'...")
        cur.execute("ALTER TABLE centers ADD COLUMN type VARCHAR(100)")
    else:
        print("Column 'type' already exists.")

    if not column_exists(cur, "centers", "bill_type"):
        print("Adding column 'bill_type'...")
        cur.execute("ALTER TABLE centers ADD COLUMN bill_type VARCHAR(100)")
    else:
        print("Column 'bill_type' already exists.")
    
    conn.commit()

    # --- 2. Backfill from metadata_json ---
    print("Fetching centers for backfill...")
    cur.execute("SELECT id, metadata_json FROM centers")
    rows = cur.fetchall()
    
    backfilled_type = 0
    backfilled_bill = 0
    
    for rid, meta in rows:
        if not meta:
            continue
            
        # In Postgres, meta might already be a dict if it's JSONB
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except:
                continue
        
        # Determine values
        bt = (meta.get("bill_type") or meta.get("billType") or 
              meta.get("Bill_Type") or meta.get("BILL_TYPE") or "")
        t = (meta.get("type") or meta.get("center_type_label") or "")
        
        # If bt is empty, use t as bill_type fallback
        if not bt and t:
            bt = t
            
        if t or bt:
            updates = []
            values = []
            if t:
                updates.append("type = %s")
                values.append(t)
            if bt:
                updates.append("bill_type = %s")
                values.append(bt)
            
            values.append(rid)
            cur.execute(f"UPDATE centers SET {', '.join(updates)} WHERE id = %s", tuple(values))
            backfilled_type += 1 if t else 0
            backfilled_bill += 1 if bt else 0

    conn.commit()
    print(f"Migration complete on Supabase.")
    print(f"Updated {backfilled_type} types and {backfilled_bill} bill_types.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
