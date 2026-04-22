import os
import sys
from dotenv import load_dotenv

# Add the current directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, Base
from app.models.entities import *  # Import all models to ensure they are registered

def init_db():
    print(f"Connecting to database: {engine.url.host}")
    print("Creating tables in Supabase...")
    try:
        Base.metadata.create_all(bind=engine)
        print("SUCCESS: Tables created successfully!")
    except Exception as e:
        print(f"ERROR: Error creating tables: {str(e)}")

if __name__ == "__main__":
    # Load .env file
    load_dotenv()
    init_db()
