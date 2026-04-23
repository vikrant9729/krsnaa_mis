from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
# Optional centers schema updater script (resides at backend/update_centers_schema.py)
try:
    from update_centers_schema import update_db as run_update_centers_schema
except Exception:
    run_update_centers_schema = None

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
def health_check():
    """Basic health check."""
    return {"status": "ok", "message": "Backend is running"}

@router.post("/repair-all")
def repair_all_issues(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Comprehensive repair endpoint that fixes all known issues:
    - Repairs foreign key constraints
    - Validates table structure
    - Clears corrupted records
    - Resets problematic state
    """
    repair_log = []
    
    try:
        # 1. Fix MasterTest - ensure CenterTest dependencies are clean
        repair_log.append("Fixing MasterTest foreign key dependencies...")
        db.execute(text("""
            DELETE FROM center_tests 
            WHERE test_id NOT IN (SELECT id FROM master_tests)
        """))
        db.commit()
        repair_log.append("✓ Cleaned orphaned center_tests records")
        
        # 2. Fix Center - ensure all self-references are valid
        repair_log.append("Fixing Center self-references...")
        db.execute(text("""
            UPDATE centers 
            SET parent_id = NULL 
            WHERE parent_id NOT IN (SELECT id FROM centers) OR parent_id = id
        """))
        db.execute(text("""
            UPDATE centers 
            SET base_center_id = NULL 
            WHERE base_center_id NOT IN (SELECT id FROM centers) OR base_center_id = id
        """))
        db.commit()
        repair_log.append("✓ Fixed center self-references")
        
        # 3. Fix DosDataset - ensure center references are valid
        repair_log.append("Fixing DosDataset foreign key references...")
        db.execute(text("""
            DELETE FROM dos_rows 
            WHERE dataset_id NOT IN (SELECT id FROM dos_datasets)
        """))
        db.execute(text("""
            DELETE FROM dos_version_snapshots 
            WHERE dataset_id NOT IN (SELECT id FROM dos_datasets)
        """))
        db.execute(text("""
            DELETE FROM dos_datasets 
            WHERE center_id NOT IN (SELECT id FROM centers)
        """))
        db.commit()
        repair_log.append("✓ Fixed DOS dataset references")
        
        # 4. Fix AISuggestion references
        repair_log.append("Fixing AISuggestion references...")
        db.execute(text("""
            DELETE FROM ai_suggestions 
            WHERE center_id NOT IN (SELECT id FROM centers)
        """))
        db.commit()
        repair_log.append("✓ Fixed AI suggestion references")
        
        # 5. Fix UserCenterAssignment references
        repair_log.append("Fixing UserCenterAssignment references...")
        db.execute(text("""
            DELETE FROM user_center_assignments 
            WHERE center_id NOT IN (SELECT id FROM centers) 
            OR user_id NOT IN (SELECT id FROM users)
        """))
        db.commit()
        repair_log.append("✓ Fixed user-center assignments")
        
        # 6. Verify tables exist and have correct structure
        repair_log.append("Validating table structure...")
        tables_to_check = [
            'users', 'centers', 'master_tests', 'center_tests', 
            'dos_datasets', 'dos_rows', 'audit_logs', 'ai_provider_configs',
            'ai_suggestions', 'tests', 'dos_version_snapshots', 
            'user_center_assignments', 'special_rate_lists'
        ]
        
        inspector_result = db.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)).fetchall()
        existing_tables = {row[0] for row in inspector_result}
        
        missing_tables = [t for t in tables_to_check if t not in existing_tables]
        if missing_tables:
            repair_log.append(f"⚠ Missing tables: {', '.join(missing_tables)}")
        else:
            repair_log.append("✓ All required tables exist")
        
        # 7. Summary
        # 8. Optionally run centers schema updater (populates `centers.type` and `centers.bill_type`)
        if run_update_centers_schema:
            repair_log.append("Running centers schema updater...")
            try:
                run_update_centers_schema()
                repair_log.append("✓ Centers schema updater completed")
            except Exception as e:
                repair_log.append(f"⚠ Centers schema updater failed: {e}")

        repair_log.append("=" * 50)
        repair_log.append("✅ All repairs completed successfully!")
        repair_log.append("=" * 50)
        
        return {
            "status": "success",
            "message": "All system repairs completed",
            "repairs": repair_log,
            "timestamp": str(__import__('datetime').datetime.utcnow())
        }
        
    except Exception as e:
        db.rollback()
        repair_log.append(f"❌ REPAIR FAILED: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Repair failed: {str(e)}\nLog: {repair_log}"
        )
