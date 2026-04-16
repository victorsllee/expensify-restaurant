import asyncio
import os
import requests
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import models
from app.api.receipts import process_receipt_async

def reprocess_empty_receipts():
    db = SessionLocal()
    # Find receipts that are PENDING but have no vendor or 0 amount
    receipts = db.query(models.Receipt).filter(
        models.Receipt.status == models.ReceiptStatus.PENDING,
        (models.Receipt.total_amount == 0) | (models.Receipt.total_amount.is_(None)) | (models.Receipt.vendor_id.is_(None))
    ).all()
    
    print(f"Found {len(receipts)} receipts to reprocess.")
    
    for r in receipts:
        print(f"Reprocessing receipt ID: {r.id}, URL: {r.image_url}")
        try:
            response = requests.get(r.image_url)
            response.raise_for_status()
            image_bytes = response.content
            mime_type = response.headers.get('Content-Type', 'image/jpeg')
            
            # Reset some fields just in case
            process_receipt_async(r.id, image_bytes, mime_type, r.user_id)
            print(f"✅ Successfully reprocessed receipt {r.id}")
        except Exception as e:
            print(f"❌ Failed to reprocess receipt {r.id}: {e}")

if __name__ == "__main__":
    reprocess_empty_receipts()
