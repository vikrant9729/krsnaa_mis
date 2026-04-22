from app.db.session import engine
from sqlalchemy import text

def repair_all_centers():
    with engine.connect() as conn:
        print("Starting Global MRP Repair for all centers...")
        
        # This SQL updates ALL center_tests from their own active DOS datasets
        sql = """
        UPDATE center_tests
        SET custom_rate = CAST(dr.data_json->>'Bill_Rate' AS FLOAT)
        FROM dos_rows dr
        JOIN dos_datasets ds ON dr.dataset_id = ds.id
        JOIN master_tests mt ON (
            (dr.data_json->>'LAB_TestID' = mt.test_code AND dr.data_json->>'LAB_TestID' IS NOT NULL) OR 
            (dr.data_json->>'Test_Code' = mt.test_code AND dr.data_json->>'Test_Code' IS NOT NULL)
        )
        WHERE center_tests.center_id = ds.center_id
        AND center_tests.test_id = mt.id
        AND ds.is_active = true
        AND (dr.data_json->>'Bill_Rate' IS NOT NULL AND dr.data_json->>'Bill_Rate' != '');
        """
        
        print("Executing global bulk update...")
        result = conn.execute(text(sql))
        conn.commit()
        print(f"Global repair complete. Total assignments updated: {result.rowcount}")

if __name__ == "__main__":
    repair_all_centers()
