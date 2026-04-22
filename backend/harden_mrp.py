"""
harden_mrp.py
=============
Permanently saves the best available center rate as the Master MRP
in the master_tests table. This ensures MRP data persists even if
all centers are deleted.

Priority:
1. HR HISAR rate (Benchmark)
2. Maximum rate from any other active center
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from sqlalchemy import text

def harden():
    db = SessionLocal()
    try:
        print("Hardening Master MRP from center data (Optimized SQL)...")
        
        # Step 1: Normalise master_tests codes and populate dos_rows.test_code
        print("Normalising master_tests codes...")
        db.execute(text("UPDATE master_tests SET test_code = UPPER(TRIM(test_code)) WHERE test_code IS NOT NULL"))
        
        print("Populating dos_rows.test_code from JSON (this might take a moment)...")
        db.execute(text("""
            UPDATE dos_rows 
            SET test_code = UPPER(TRIM(COALESCE(data_json->>'LAB_TestID', data_json->>'Test_Code', '')))
            WHERE test_code IS NULL OR test_code = ''
        """))
        db.commit()

        # Step 2: Use SQL to find best rates and update MasterTest
        # This query uses DISTINCT ON (postgres) to pick the best source per test_code
        sql = """
            UPDATE master_tests mt
            SET custom_mrp = sub.rate,
                mrp_source = sub.cname
            FROM (
                SELECT DISTINCT ON (dr.test_code)
                    dr.test_code,
                    CAST(COALESCE(NULLIF(dr.data_json->>'Bill_Rate',''), NULLIF(dr.data_json->>'Rate',''), NULLIF(dr.data_json->>'MRP',''), '0') AS FLOAT) as rate,
                    c.name as cname
                FROM dos_rows dr
                JOIN dos_datasets dd ON dr.dataset_id = dd.id
                JOIN centers c ON dd.center_id = c.id
                WHERE dd.is_active = true
                  AND CAST(COALESCE(NULLIF(dr.data_json->>'Bill_Rate',''), NULLIF(dr.data_json->>'Rate',''), NULLIF(dr.data_json->>'MRP',''), '0') AS FLOAT) > 0
                ORDER BY dr.test_code, (c.name ILIKE '%HR HISAR%') DESC, 2 DESC
            ) sub
            WHERE mt.test_code = sub.test_code
              AND (mt.custom_mrp IS NULL OR mt.custom_mrp = 0)
        """
        
        result = db.execute(text(sql))
        db.commit()
        
        print(f"Success! Hardened {result.rowcount} Master MRP entries.")
        print("Now the Master Data MRP will remain even if centers are deleted.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    harden()
