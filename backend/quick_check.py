"""
quick_check.py
==============
Quick diagnostic tool to verify database health.
Run this anytime to check if your database is in good shape.
"""

import sys
import os
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal

def check_database_health():
    """Run quick health checks on the database"""
    
    print("\n" + "="*60)
    print("🔍 KRSNAA MIS - DATABASE HEALTH CHECK")
    print("="*60)
    
    db = SessionLocal()
    issues = []
    warnings = []
    
    try:
        # 1. Check tables exist
        print("\n📊 Checking Tables...")
        tables_to_check = [
            'centers', 'users', 'master_tests', 'dos_datasets', 
            'dos_rows', 'center_tests', 'special_rate_lists',
            'ai_provider_configs', 'audit_logs'
        ]
        
        for table in tables_to_check:
            try:
                result = db.execute(text(f"SELECT count(*) FROM {table}"))
                count = result.scalar()
                print(f"  ✅ {table}: {count} rows")
            except Exception as e:
                print(f"  ❌ {table}: MISSING")
                issues.append(f"Table '{table}' is missing")
        
        # 2. Check critical columns
        print("\n🔧 Checking Critical Columns...")
        
        # centers table
        for col in ['type', 'bill_type']:
            try:
                db.execute(text(f"SELECT {col} FROM centers LIMIT 1"))
                print(f"  ✅ centers.{col}")
            except:
                print(f"  ❌ centers.{col} MISSING")
                issues.append(f"Column 'centers.{col}' is missing")
        
        # master_tests table
        for col in ['custom_mrp', 'mrp_source', 'test_code']:
            try:
                db.execute(text(f"SELECT {col} FROM master_tests LIMIT 1"))
                print(f"  ✅ master_tests.{col}")
            except:
                print(f"  ⚠️  master_tests.{col} MISSING")
                warnings.append(f"Column 'master_tests.{col}' is missing")
        
        # dos_rows table
        try:
            db.execute(text("SELECT test_code FROM dos_rows LIMIT 1"))
            print(f"  ✅ dos_rows.test_code")
        except:
            print(f"  ⚠️  dos_rows.test_code MISSING")
            warnings.append("Column 'dos_rows.test_code' is missing")
        
        # 3. Check for admin user
        print("\n👤 Checking Admin User...")
        from app.models.entities import User
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            print(f"  ✅ Admin user exists (ID: {admin.id})")
        else:
            print(f"  ❌ No admin user found")
            issues.append("No admin user exists")
        
        # 4. Check centers data
        print("\n🏢 Checking Centers...")
        from app.models.entities import Center
        centers = db.query(Center).all()
        print(f"  ✅ {len(centers)} centers found")
        
        centers_without_type = db.query(Center).filter(
            (Center.type == None) | (Center.type == '')
        ).count()
        if centers_without_type > 0:
            print(f"  ⚠️  {centers_without_type} centers missing 'type'")
            warnings.append(f"{centers_without_type} centers missing type")
        
        # 5. Check DOS datasets
        print("\n📁 Checking DOS Datasets...")
        from app.models.entities import DosDataset
        active_datasets = db.query(DosDataset).filter(DosDataset.is_active == True).all()
        print(f"  ✅ {len(active_datasets)} active datasets")
        
        # 6. Check center tests
        print("\n🧪 Checking Center Tests...")
        from app.models.entities import CenterTest
        center_tests = db.query(CenterTest).all()
        print(f"  ✅ {len(center_tests)} center test assignments")
        
        zero_rate_tests = db.query(CenterTest).filter(
            (CenterTest.custom_rate == None) | (CenterTest.custom_rate == 0)
        ).count()
        if zero_rate_tests > 0:
            print(f"  ⚠️  {zero_rate_tests} tests with zero/null rates")
            warnings.append(f"{zero_rate_tests} tests have zero rates")
        
        # 7. Check indexes
        print("\n⚡ Checking Indexes...")
        try:
            indexes = db.execute(text("""
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'dos_rows' AND indexname LIKE '%test_code%'
            """)).fetchall()
            if indexes:
                print(f"  ✅ dos_rows indexes found")
            else:
                print(f"  ⚠️  dos_rows indexes may be missing")
                warnings.append("dos_rows indexes may be missing")
        except:
            print(f"  ℹ️  Skipping index check (SQLite or different schema)")
        
        # Summary
        print("\n" + "="*60)
        print("📋 HEALTH CHECK SUMMARY")
        print("="*60)
        
        if issues:
            print(f"\n❌ CRITICAL ISSUES ({len(issues)}):")
            for issue in issues:
                print(f"  • {issue}")
        
        if warnings:
            print(f"\n⚠️  WARNINGS ({len(warnings)}):")
            for warning in warnings:
                print(f"  • {warning}")
        
        if not issues and not warnings:
            print("\n🎉 DATABASE HEALTH: EXCELLENT")
            print("   Everything looks good!")
        elif not issues:
            print(f"\n✅ DATABASE HEALTH: GOOD (with {len(warnings)} warnings)")
            print("   App should work fine, but consider fixing warnings")
        else:
            print(f"\n⚠️  DATABASE HEALTH: NEEDS ATTENTION")
            print("   Please run: python auto_setup.py")
        
        print("="*60 + "\n")
        
        return len(issues) == 0
        
    except Exception as e:
        print(f"\n❌ Health check failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = check_database_health()
    sys.exit(0 if success else 1)
