from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

@router.get("")
def get_history(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetch all receipts regardless of status, including line items, scoped to the current user."""
    receipts = db.query(models.Receipt)\
        .filter(models.Receipt.user_id == user['uid'])\
        .order_by(desc(models.Receipt.created_at))\
        .all()
    
    result = []
    for r in receipts:
        vendor_name = "Unknown Vendor"
        if r.vendor_id:
            vendor = db.query(models.Vendor).filter(models.Vendor.id == r.vendor_id).first()
            vendor_name = vendor.name if vendor else "Unknown Vendor"
            
        main_category = None
        if r.main_category_id:
            cat = db.query(models.Category).filter(models.Category.id == r.main_category_id).first()
            if cat:
                main_category = {"id": cat.id, "name": cat.name, "color_code": cat.color_code}
            
        line_items = db.query(models.LineItem).filter(models.LineItem.receipt_id == r.id).all()
        formatted_items = []
        for li in line_items:
            li_cat = None
            if li.category_id:
                cat = db.query(models.Category).filter(models.Category.id == li.category_id).first()
                if cat:
                    li_cat = {"id": cat.id, "name": cat.name, "color_code": cat.color_code}
            formatted_items.append({
                "id": li.id, 
                "description": li.description, 
                "amount": li.amount,
                "category": li_cat
            })
            
        result.append({
            "id": r.id,
            "image_url": r.image_url,
            "vendor": vendor_name,
            "total_amount": r.total_amount,
            "tax_amount": r.tax_amount,
            "currency": r.currency or "$",
            "date": r.date.strftime("%Y-%m-%d") if r.date else None,
            "status": r.status.value,
            "track_line_items": r.track_line_items,
            "main_category": main_category,
            "line_items": formatted_items
        })
        
    return {"status": "success", "data": result}