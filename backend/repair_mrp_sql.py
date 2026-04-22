from app.db.session import engine
from sqlalchemy import text

def repair_sql():
    with engine.connect() as conn:
        print("Finding HR HISAR ID...")
        res = conn.execute(text("SELECT id FROM centers WHERE name ILIKE '%HR HISAR%' OR code ILIKE '%HISAR%' LIMIT 1"))
        row = res.fetchone()
        if not row:
            print("HR HISAR not found.")
            return
        
        hisar_id = row[0]
        print(f"Found HR HISAR ID: {hisar_id}")
        
        # SQL to update center_tests from the latest active dataset of the same center
        sql = f"""
        UPDATE center_tests
        SET custom_rate = CAST(dr.data_json->>'Bill_Rate' AS FLOAT)
        FROM dos_rows dr
        JOIN dos_datasets ds ON dr.dataset_id = ds.id
        JOIN master_tests mt ON (
            (dr.data_json->>'LAB_TestID' = mt.test_code AND dr.data_json->>'LAB_TestID' IS NOT NULL) OR 
            (dr.data_json->>'Test_Code' = mt.test_code AND dr.data_json->>'Test_Code' IS NOT NULL)
        )
        WHERE center_tests.center_id = :hisar_id
        AND center_tests.test_id = mt.id
        AND ds.center_id = :hisar_id
        AND ds.is_active = true
        """
        
        print("Executing bulk update...")
        result = conn.execute(text(sql), {"hisar_id": hisar_id})
        conn.commit()
        print(f"Repair complete. Rows affected: {result.rowcount}")

if __name__ == "__main__":
    repair_sql()
