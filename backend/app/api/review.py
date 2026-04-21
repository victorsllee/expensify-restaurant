from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.api.auth import verify_token
from app.database import get_db
from app.models import models
from app.services.zoho import push_receipt_to_zoho
from app.services.learning import learn_from_receipt

router = APIRouter()

class LineItemUpdate(BaseModel):
    id: int
    category_id: Optional[int] = None
    description: Optional[str] = None
    amount: Optional[float] = None

class ReceiptUpdate(BaseModel):
    vendor: Optional[str] = None
    date: Optional[str] = None
    total_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    main_category_id: Optional[int] = None
    line_items: Optional[List[LineItemUpdate]] = None

class BulkActionRequest(BaseModel):
    receipt_ids: List[int]

def handle_single_approval(receipt_id: int, user_id: str, db: Session, bg_tasks: BackgroundTasks):
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == user_id,
        models.Receipt.status == models.ReceiptStatus.PENDING
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    receipt.status = models.ReceiptStatus.APPROVED
    db.commit()
    
    # Trigger Zoho integration if enabled
    user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
    if user_settings and user_settings.zoho_integration_enabled:
        bg_tasks.add_task(push_receipt_to_zoho, receipt.id, user_id)
    
    # Trigger AI Learning
    bg_tasks.add_task(learn_from_receipt, receipt.id, user_id)

def handle_single_rejection(receipt_id: int, user_id: str, db: Session):
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == user_id,
        models.Receipt.status == models.ReceiptStatus.PENDING
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    receipt.status = models.ReceiptStatus.REJECTED
    db.commit()

def handle_single_deletion(receipt_id: int, user_id: str, db: Session):
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == user_id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    db.delete(receipt)
    db.commit()

@router.get("/queue")
def get_review_queue(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetch all PENDING receipts with their vendor, main category, and line items."""
    # Use eager loading to prevent N+1 queries
    receipts = db.query(models.Receipt)\
        .options(
            joinedload(models.Receipt.vendor),
            joinedload(models.Receipt.main_category),
            selectinload(models.Receipt.line_items).selectinload(models.LineItem.category)
        )\
        .filter(
            models.Receipt.status.in_([models.ReceiptStatus.PENDING, models.ReceiptStatus.PROCESSING, models.ReceiptStatus.FAILED]),
            models.Receipt.user_id == user['uid']
        )\
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
            "description": r.description,
            "currency": r.currency or "$",
            "date": r.date.strftime("%Y-%m-%d") if r.date else None,
            "status": r.status.value,
            "track_line_items": r.track_line_items,
            "error_message": r.error_message,
            "main_category": main_category,
            "line_items": formatted_items
        })
        
    return {"status": "success", "data": result}

@router.put("/bulk-approve")
def bulk_approve_receipts(data: BulkActionRequest, background_tasks: BackgroundTasks, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Approve multiple receipts, moving them out of the review queue and handling line item tracking logic."""
    for rid in data.receipt_ids:
        handle_single_approval(rid, user['uid'], db, background_tasks)
    return {"status": "success", "message": f"{len(data.receipt_ids)} receipts approved successfully"}

@router.put("/bulk-reject")
def bulk_reject_receipts(data: BulkActionRequest, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Reject multiple receipts, moving them out of the review queue."""
    for rid in data.receipt_ids:
        handle_single_rejection(rid, user['uid'], db)
    return {"status": "success", "message": f"{len(data.receipt_ids)} receipts rejected successfully"}

@router.delete("/bulk-delete")
def bulk_delete_receipts(data: BulkActionRequest, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Delete multiple receipts from the database."""
    for rid in data.receipt_ids:
        handle_single_deletion(rid, user['uid'], db)
    return {"status": "success", "message": f"{len(data.receipt_ids)} receipts deleted successfully"}

@router.put("/{receipt_id}")
def update_receipt(receipt_id: int, data: ReceiptUpdate, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Update receipt data including categories."""
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == user['uid']
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    if data.vendor is not None:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.name.ilike(data.vendor),
            models.Vendor.user_id == user['uid']
        ).first()
        if not vendor:
            vendor = models.Vendor(name=data.vendor, user_id=user['uid'])
            db.add(vendor)
            db.commit()
            db.refresh(vendor)
        receipt.vendor_id = vendor.id
        
    if data.total_amount is not None:
        receipt.total_amount = data.total_amount
    if data.tax_amount is not None:
        receipt.tax_amount = data.tax_amount
    if data.description is not None:
        receipt.description = data.description
    if data.currency is not None:
        receipt.currency = data.currency
    if data.main_category_id is not None:
        receipt.main_category_id = data.main_category_id
    if data.date is not None:
        try:
            receipt.date = datetime.strptime(data.date, "%Y-%m-%d")
        except ValueError:
            pass

    if data.line_items is not None:
        for li_data in data.line_items:
            li = db.query(models.LineItem).filter(models.LineItem.id == li_data.id, models.LineItem.receipt_id == receipt.id).first()
            if li:
                if li_data.category_id is not None:
                    li.category_id = li_data.category_id
                if li_data.description is not None:
                    li.description = li_data.description
                if li_data.amount is not None:
                    li.amount = li_data.amount

    db.commit()
    return {"status": "success", "message": "Receipt updated successfully"}

@router.put("/{receipt_id}/approve")
def approve_receipt(receipt_id: int, background_tasks: BackgroundTasks, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Approve a single receipt."""
    handle_single_approval(receipt_id, user['uid'], db, background_tasks)
    return {"status": "success", "message": "Receipt approved successfully"}

@router.put("/{receipt_id}/reject")
def reject_receipt(receipt_id: int, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Reject a single receipt."""
    handle_single_rejection(receipt_id, user['uid'], db)
    return {"status": "success", "message": "Receipt rejected successfully"}

@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: int, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Delete a single receipt."""
    handle_single_deletion(receipt_id, user['uid'], db)
    return {"status": "success", "message": "Receipt deleted successfully"}
