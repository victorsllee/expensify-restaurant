from app.database import SessionLocal
from app.models import models

db = SessionLocal()
receipts = db.query(models.Receipt).filter(models.Receipt.status == models.ReceiptStatus.PENDING).all()
for r in receipts:
    vendor_name = r.vendor.name if r.vendor else "None"
    print(f"Receipt {r.id}: Vendor={vendor_name}, Total={r.total_amount}, Tax={r.tax_amount}, Date={r.date}")
    for li in r.line_items:
        print(f"  - {li.description}: {li.amount}")
