from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

DEFAULT_CATEGORIES = [
    {"name": "Meat", "color_code": "#EF4444"},
    {"name": "Seafood", "color_code": "#3B82F6"},
    {"name": "Produce", "color_code": "#10B981"},
    {"name": "Dairy", "color_code": "#F59E0B"},
    {"name": "Beverages", "color_code": "#8B5CF6"},
    {"name": "Rent", "color_code": "#6366F1"},
    {"name": "Utilities", "color_code": "#14B8A6"},
    {"name": "Supplies", "color_code": "#64748B"},
    {"name": "Maintenance", "color_code": "#F97316"}
]

class CategoryCreate(BaseModel):
    name: str
    color_code: Optional[str] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    color_code: Optional[str]
    
    class Config:
        orm_mode = True

@router.get("", response_model=List[CategoryResponse])
def get_categories(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    categories = db.query(models.Category).filter(models.Category.user_id == user['uid']).all()
    
    # Auto-seed default categories if the user has none
    if not categories:
        for cat in DEFAULT_CATEGORIES:
            new_cat = models.Category(
                user_id=user['uid'],
                name=cat["name"],
                color_code=cat["color_code"]
            )
            db.add(new_cat)
        db.commit()
        categories = db.query(models.Category).filter(models.Category.user_id == user['uid']).all()
        
    return categories

@router.post("", response_model=CategoryResponse)
def create_category(category: CategoryCreate, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    existing = db.query(models.Category).filter(
        models.Category.user_id == user['uid'],
        models.Category.name.ilike(category.name)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
        
    new_cat = models.Category(
        user_id=user['uid'],
        name=category.name,
        color_code=category.color_code
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, category_data: CategoryCreate, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == user['uid']
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Check if another category with the new name already exists
    if category_data.name.lower() != category.name.lower():
        existing = db.query(models.Category).filter(
            models.Category.user_id == user['uid'],
            models.Category.name.ilike(category_data.name),
            models.Category.id != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another category with this name already exists")
    
    category.name = category_data.name
    category.color_code = category_data.color_code
    db.commit()
    db.refresh(category)
    return category

@router.delete("/{category_id}")
def delete_category(category_id: int, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == user['uid']
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    db.delete(category)
    db.commit()
    return {"status": "success"}
