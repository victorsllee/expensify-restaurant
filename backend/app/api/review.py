from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.api.auth import verify_token
from app.database import get_db
from app.models import models
from app.services.zoho import push_receipt_to_zoho

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
    main_category_id: Optional[int] = None
    line_items: Optional[List[LineItemUpdate]] = None

class BulkApproveRequest(BaseModel):
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
        line_items = db.query(models.LineItem).filter(models.LineItem.receipt_id == receipt.id).all()
        bg_tasks.add_task(push_receipt_to_zoho, receipt, vendor, main_category, line_items, user_settings, db)

@router.get("/queue")
def get_review_queue(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetch all PENDING receipts with their vendor, main category, and line items."""
    receipts = db.query(models.Receipt)\
        .filter(
            models.Receipt.status == models.ReceiptStatus.PENDING,
            models.Receipt.user_id == user['uid']
        )\
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

@router.put("/bulk-approve")
def bulk_approve_receipts(data: BulkApproveRequest, background_tasks: BackgroundTasks, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Approve multiple receipts, moving them out of the review queue and handling line item tracking logic."""
    for rid in data.receipt_ids:
        handle_single_approval(rid, user['uid'], db, background_tasks)
    return {"status": "success", "message": f"{len(data.receipt_ids)} receipts approved successfully"}

@router.put("/{receipt_id}/approve")
def approve_receipt(receipt_id: int, background_tasks: BackgroundTasks, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Approve a single receipt."""
    handle_single_approval(receipt_id, user['uid'], db, background_tasks)
    return {"status": "success", "message": "Receipt approved successfully"}
