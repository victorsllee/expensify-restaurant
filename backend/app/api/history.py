from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

@router.get("")
def get_history(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetch all receipts regardless of status, including line items, scoped to the current user."""
    # Use eager loading to prevent N+1 queries
    receipts = db.query(models.Receipt)\
        .options(
            joinedload(models.Receipt.vendor),
            joinedload(models.Receipt.main_category),
            selectinload(models.Receipt.line_items).selectinload(models.LineItem.category)
        )\
        .filter(models.Receipt.user_id == user['uid'])\
        .order_by(desc(models.Receipt.created_at))\
        .all()
    
    result = []
    for r in receipts:
        vendor_name = r.vendor.name if r.vendor else "Unknown Vendor"
            
        main_category = None
        if r.main_category:
            main_category = {
                "id": r.main_category.id, 
                "name": r.main_category.name, 
                "color_code": r.main_category.color_code
            }
            
        formatted_items = []
        for li in r.line_items:
            li_cat = None
            if li.category:
                li_cat = {
                    "id": li.category.id, 
                    "name": li.category.name, 
                    "color_code": li.category.color_code
                }
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
            "zoho_expense_id": r.zoho_expense_id,
            "error_message": r.error_message,
            "main_category": main_category,
            "line_items": formatted_items
        })
        
    return {"status": "success", "data": result}
