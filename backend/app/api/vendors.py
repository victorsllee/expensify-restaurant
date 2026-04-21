from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    default_category: Optional[str] = None
    zoho_merchant_id: Optional[str] = None

class MergeRequest(BaseModel):
    primary_vendor_id: int
    duplicate_vendor_id: int

@router.get("")
def get_vendors(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    vendors = db.query(models.Vendor)\
        .filter(models.Vendor.user_id == user['uid'])\
        .order_by(desc(models.Vendor.last_seen_at))\
        .all()
    
    # We could attach counts of receipts per vendor here for UI
    result = []
    for v in vendors:
        receipt_count = db.query(models.Receipt).filter(models.Receipt.vendor_id == v.id).count()
        result.append({
            "id": v.id,
            "name": v.name,
            "default_category": v.default_category,
            "zoho_merchant_id": v.zoho_merchant_id,
            "receipt_count": receipt_count,
            "last_seen_at": v.last_seen_at
        })
        
    return {"status": "success", "data": result}

@router.put("/{vendor_id}")
def update_vendor(vendor_id: int, data: VendorUpdate, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id, 
        models.Vendor.user_id == user['uid']
    ).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    if data.name is not None:
        vendor.name = data.name
    if data.default_category is not None:
        vendor.default_category = data.default_category
    if data.zoho_merchant_id is not None:
        vendor.zoho_merchant_id = data.zoho_merchant_id
        
    db.commit()
    return {"status": "success", "message": "Vendor updated"}

@router.post("/merge")
def merge_vendors(data: MergeRequest, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    primary = db.query(models.Vendor).filter(
        models.Vendor.id == data.primary_vendor_id,
        models.Vendor.user_id == user['uid']
    ).first()
    
    duplicate = db.query(models.Vendor).filter(
        models.Vendor.id == data.duplicate_vendor_id,
        models.Vendor.user_id == user['uid']
    ).first()
    
    if not primary or not duplicate:
        raise HTTPException(status_code=404, detail="One or both vendors not found")
        
    if primary.id == duplicate.id:
        raise HTTPException(status_code=400, detail="Cannot merge a vendor into itself")
        
    # Migrate all receipts from duplicate to primary
    db.query(models.Receipt)\
        .filter(models.Receipt.vendor_id == duplicate.id)\
        .update({"vendor_id": primary.id})
        
    # Delete the duplicate
    db.delete(duplicate)
    db.commit()
    
    return {"status": "success", "message": f"Successfully merged '{duplicate.name}' into '{primary.name}'"}
