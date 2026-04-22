import os
import sys
from dotenv import load_dotenv

# Add the current directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.entities import User

def check_users():
    load_dotenv()
    db = SessionLocal()
    users = db.query(User).all()
    print(f"Total users in database: {len(users)}")
    for u in users:
        print(f"User: {u.username}, Role: {u.role}")
    db.close()

if __name__ == "__main__":
    check_users()
