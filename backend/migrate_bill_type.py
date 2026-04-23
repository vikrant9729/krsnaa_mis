"""
Migration: Add `type` and `bill_type` columns to the centers table.
Backfills bill_type from metadata_json where available.
Safe to run multiple times (checks if columns already exist first).
"""
import sqlite3
import json

DB_PATH = "backend/krsnaa.db"

def column_exists(cur, table, column):
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # --- 1. Add missing columns ---
    added = []
    if not column_exists(cur, "centers", "type"):
        cur.execute("ALTER TABLE centers ADD COLUMN type VARCHAR(100)")
        added.append("type")
        print("  + Added column: type")
    else:
        print("  . Column 'type' already exists, skipping.")

    if not column_exists(cur, "centers", "bill_type"):
        cur.execute("ALTER TABLE centers ADD COLUMN bill_type VARCHAR(100)")
        added.append("bill_type")
        print("  + Added column: bill_type")
    else:
        print("  . Column 'bill_type' already exists, skipping.")

    conn.commit()

    # --- 2. Inspect & backfill from metadata_json ---
    cur.execute("SELECT id, name, center_type, metadata_json FROM centers")
    rows = cur.fetchall()

    print(f"\nInspecting {len(rows)} centers for metadata_json data...\n")
    backfilled = 0

    for row in rows:
        cid, name, ctype, meta_raw = row
        meta = {}
        if meta_raw:
            try:
                meta = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
            except Exception:
                meta = {}

        meta_keys = list(meta.keys())
        bt = (meta.get("bill_type") or meta.get("billType") or
              meta.get("Bill_Type") or meta.get("BILL_TYPE") or "")
        t  = (meta.get("type") or meta.get("center_type_label") or "")

        print(f"  id={cid:4d} | {name[:40]:40s} | ctype={ctype} | meta_keys={meta_keys} | bill_type={bt!r} | type={t!r}")

        # Backfill if we found values in metadata_json
        updates = {}
        if bt:
            updates["bill_type"] = bt
        if t:
            updates["type"] = t

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [cid]
            cur.execute(f"UPDATE centers SET {set_clause} WHERE id = ?", values)
            backfilled += 1

    conn.commit()
    conn.close()

    print(f"\nMigration complete.")
    print(f"  Columns added: {added if added else 'none (already existed)'}")
    print(f"  Rows backfilled from metadata_json: {backfilled}")
    print("\nNext step: Restart the backend server.")

if __name__ == "__main__":
    main()
