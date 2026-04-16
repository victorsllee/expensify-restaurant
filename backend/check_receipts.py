import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))
from app.database import SessionLocal
from app.models import models

db = SessionLocal()
receipts = db.query(models.Receipt).all()
print(f"Total receipts: {len(receipts)}")
for r in receipts:
    print(f"ID: {r.id}, Status: {r.status.value}, Error: {r.error_message}")
