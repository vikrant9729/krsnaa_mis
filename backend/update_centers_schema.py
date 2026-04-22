from app.db.session import engine
from sqlalchemy import text

def update_db():
    with engine.connect() as conn:
        print("Adding new columns to centers table...")
        try:
            conn.execute(text("ALTER TABLE centers ADD COLUMN type VARCHAR(100)"))
            conn.execute(text("ALTER TABLE centers ADD COLUMN bill_type VARCHAR(100)"))
            conn.commit()
            print("Columns added successfully.")
        except Exception as e:
            print(f"Note: Columns might already exist: {e}")
            conn.rollback()

        print("Populating columns from DOS data...")
        # Get all centers
        res = conn.execute(text("SELECT id FROM centers"))
        center_ids = [r[0] for r in res.fetchall()]
        
        for cid in center_ids:
            # Find latest active DOS row for this center
            row_res = conn.execute(text("""
                SELECT data_json FROM dos_rows dr
                JOIN dos_datasets ds ON dr.dataset_id = ds.id
                WHERE ds.center_id = :cid AND ds.is_active = true
                LIMIT 1
            """), {"cid": cid})
            
            row = row_res.fetchone()
            if row:
                data = row[0]
                c_type = data.get("type") or data.get("Type") or data.get("TYPE")
                b_type = data.get("bill type") or data.get("Bill Type") or data.get("BILL TYPE") or data.get("bill_type")
                
                if c_type or b_type:
                    conn.execute(text("UPDATE centers SET type = :ctype, bill_type = :btype WHERE id = :cid"), {
                        "ctype": str(c_type) if c_type else None,
                        "btype": str(b_type) if b_type else None,
                        "cid": cid
                    })
                    print(f"Updated center {cid}: Type={c_type}, BillType={b_type}")
        
        conn.commit()
        print("Population complete.")

if __name__ == "__main__":
    update_db()
