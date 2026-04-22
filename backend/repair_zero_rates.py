"""
repair_zero_rates.py
====================
Fixes Rs 0 / missing CenterTest rates by:
1. Deduplicating master_tests that differ only in case (merge lowercase into uppercase)
2. Normalising dos_rows.test_code to UPPERCASE
3. Re-syncing CenterTest.custom_rate from DOS data for every zero/null entry

Run from the backend/ directory:
    python repair_zero_rates.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from sqlalchemy import text
from app.models.entities import MasterTest, CenterTest, DosDataset, DosRow


def repair():
    db = SessionLocal()
    try:
        # ----------------------------------------------------------------
        # Step 1: De-duplicate master_tests (merge lowercase -> uppercase)
        # ----------------------------------------------------------------
        print("Step 1: De-duplicating master_tests with case-only differences ...")

        all_tests = db.query(MasterTest).all()
        # Build map: UPPER(code) -> list of MasterTest objects
        by_upper = {}
        for mt in all_tests:
            key = mt.LAB_TestID.strip().upper()
            by_upper.setdefault(key, []).append(mt)

        merged = 0
        for upper_code, entries in by_upper.items():
            if len(entries) <= 1:
                continue

            # Pick the one with the "correct" uppercase code as canonical
            canonical = next((e for e in entries if e.LAB_TestID == upper_code), entries[0])
            duplicates = [e for e in entries if e.id != canonical.id]

            for dup in duplicates:
                # Re-point all CenterTests from the duplicate to canonical
                db.execute(text(
                    "UPDATE center_tests SET test_id = :canon_id WHERE test_id = :dup_id"
                ).bindparams(canon_id=canonical.id, dup_id=dup.id))
                db.flush()
                # Delete the duplicate
                db.execute(text(
                    "DELETE FROM master_tests WHERE id = :dup_id"
                ).bindparams(dup_id=dup.id))
                db.flush()
                merged += 1
                print(f"  Merged '{dup.LAB_TestID}' (id={dup.id}) -> '{canonical.LAB_TestID}' (id={canonical.id})")

        # Now safely uppercase remaining test_codes
        db.execute(text(
            "UPDATE master_tests SET test_code = UPPER(TRIM(test_code)) WHERE test_code IS NOT NULL"
        ))
        db.commit()
        print(f"  Done. Removed {merged} duplicate entries and normalised to UPPERCASE.")

        # ----------------------------------------------------------------
        # Step 2: Normalise dos_rows.test_code column to UPPERCASE
        # ----------------------------------------------------------------
        print("Step 2: Normalising dos_rows.test_code to UPPERCASE ...")
        result = db.execute(text(
            "UPDATE dos_rows SET test_code = UPPER(TRIM(test_code)) WHERE test_code IS NOT NULL"
        ))
        db.commit()
        print(f"  Done. ({result.rowcount} rows updated)")

        # ----------------------------------------------------------------
        # Step 3: Re-sync CenterTest rates from DOS active data
        # ----------------------------------------------------------------
        print("Step 3: Re-syncing zero/null CenterTest rates from active DOS data ...")

        active_datasets = db.query(DosDataset).filter(DosDataset.is_active == True).all()
        total_fixed = 0
        centers_fixed = 0

        for ds in active_datasets:
            center_id = ds.center_id

            # Build code -> rate map from DOS rows
            dos_rate_map = {}
            dos_rows = db.query(DosRow).filter(DosRow.dataset_id == ds.id).all()
            for row in dos_rows:
                code = row.test_code or str(
                    row.data_json.get("LAB_TestID") or row.data_json.get("Test_Code") or ""
                ).strip().upper()
                if not code:
                    continue
                for key in ("Bill_Rate", "Rate", "MRP", "bill_rate", "rate", "mrp"):
                    val = row.data_json.get(key)
                    if val is not None:
                        try:
                            rate = float(val)
                            if rate > 0:
                                dos_rate_map[code] = rate
                                break
                        except (ValueError, TypeError):
                            pass

            if not dos_rate_map:
                continue

            # Fix zero/null rates
            cts = (
                db.query(CenterTest)
                .filter(CenterTest.center_id == center_id)
                .filter(
                    (CenterTest.custom_rate == None) |
                    (CenterTest.custom_rate == 0)
                )
                .all()
            )

            fixed_here = 0
            for ct in cts:
                mt = db.query(MasterTest).filter(MasterTest.id == ct.test_id).first()
                if not mt:
                    continue
                code = str(mt.LAB_TestID or "").strip().upper()
                if code in dos_rate_map:
                    ct.custom_rate = dos_rate_map[code]
                    fixed_here += 1
                    total_fixed += 1

            if fixed_here > 0:
                db.commit()
                centers_fixed += 1
                print(f"  Center {center_id}: fixed {fixed_here} zero rates")

        # ----------------------------------------------------------------
        # Step 4: Harden Master MRP from center rates
        # ----------------------------------------------------------------
        print("\nStep 4: Hardening Master MRP from center rates ...")
        
        # Build a global map of code -> list of rates
        global_rate_map = {}
        for ds in active_datasets:
            dos_rows = db.query(DosRow).filter(DosRow.dataset_id == ds.id).all()
            center_name = db.execute(text("SELECT name FROM centers WHERE id = :cid"), {"cid": ds.center_id}).scalar()
            for row in dos_rows:
                code = row.test_code
                if not code: continue
                
                for key in ("Bill_Rate", "Rate", "MRP", "bill_rate", "rate", "mrp"):
                    val = row.data_json.get(key)
                    if val:
                        try:
                            rate = float(val)
                            if rate > 0:
                                global_rate_map.setdefault(code, []).append({
                                    "rate": rate, 
                                    "center": center_name or "Unknown"
                                })
                                break
                        except: pass

        mrp_fixed = 0
        for code, rates in global_rate_map.items():
            # Logic: Prioritize HR HISAR, else Max rate
            target_rate = 0
            source_name = ""
            
            hisar = next((r for r in rates if "HR HISAR" in r["center"].upper()), None)
            if hisar:
                target_rate = hisar["rate"]
                source_name = hisar["center"]
            else:
                max_r = max(rates, key=lambda x: x["rate"])
                target_rate = max_r["rate"]
                source_name = max_r["center"]
            
            # Update MasterTest if custom_mrp is null or 0
            res = db.execute(text("""
                UPDATE master_tests 
                SET test_code = :code, -- just to be safe
                    custom_mrp = :rate,
                    mrp_source = :source
                WHERE test_code = :code AND (custom_mrp IS NULL OR custom_mrp = 0)
            """), {"code": code, "rate": target_rate, "source": source_name})
            mrp_fixed += res.rowcount

        db.commit()
        print(f"  Done. Hardened {mrp_fixed} Master MRP entries.")
        print("\nRepair complete! All Center rates and Master MRPs have been fixed.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    repair()
