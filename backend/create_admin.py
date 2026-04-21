"""Script to create initial admin user."""

from app.db.session import SessionLocal
from app.models.entities import User, RoleEnum
from app.services.security import hash_password

def create_admin_user():
    db = SessionLocal()
    
    # Check if admin already exists
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        print("Admin user already exists!")
        db.close()
        return
    
    # Create admin user
    admin = User(
        username="admin",
        full_name="Admin User",
        password_hash=hash_password("admin123"),
        role=RoleEnum.ADMIN,
        is_active=True,
    )
    
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    print("✅ Admin user created successfully!")
    print("\n📧 Login Credentials:")
    print(f"   Username: admin")
    print(f"   Password: admin123")
    print(f"   Role: ADMIN")
    print("\n🌐 Login at: http://localhost:3000/login")
    
    db.close()

if __name__ == "__main__":
    create_admin_user()
