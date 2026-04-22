from app.db.session import SessionLocal
from app.models.entities import Center, User
from app.api.centers import list_centers
from fastapi import Request

db = SessionLocal()
admin = db.query(User).filter(User.username == "admin").first()

print(f"Testing list_centers for user: {admin.username} (Role: {admin.role})")
try:
    centers = list_centers(db=db, current_user=admin)
    print(f"Successfully fetched {len(centers)} centers")
    if len(centers) > 0:
        print(f"First center: {centers[0].name} ({centers[0].center_code})")
except Exception as e:
    print(f"Error: {e}")
db.close()
