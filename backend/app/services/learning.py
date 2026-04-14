from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import models
import re

def learn_from_receipt(receipt_id: int, user_id: str):
    """
    Background task to extract keywords from approved receipt line items 
    and update the AI's category memory.
    """
    db = SessionLocal()
    try:
        receipt = db.query(models.Receipt).filter(models.Receipt.id == receipt_id).first()
        if not receipt:
            return

        # We learn from both line items and the main category
        items_to_process = []
        
        # 1. Main category keyword learning (from vendor name)
        if receipt.vendor and receipt.main_category_id:
            items_to_process.append({
                "text": receipt.vendor.name,
                "category_id": receipt.main_category_id
            })

        # 2. Line item keyword learning
        for li in receipt.line_items:
            # Use line item category if set, otherwise fallback to main category
            cat_id = li.category_id or receipt.main_category_id
            if cat_id and li.description:
                items_to_process.append({
                    "text": li.description,
                    "category_id": cat_id
                })

        for item in items_to_process:
            keywords = extract_keywords(item["text"])
            for kw in keywords:
                # Upsert keyword learning
                learning = db.query(models.CategoryLearning).filter(
                    models.CategoryLearning.user_id == user_id,
                    models.CategoryLearning.keyword == kw,
                    models.CategoryLearning.category_id == item["category_id"]
                ).first()

                if learning:
                    learning.frequency += 1
                else:
                    learning = models.CategoryLearning(
                        user_id=user_id,
                        keyword=kw,
                        category_id=item["category_id"],
                        frequency=1
                    )
                    db.add(learning)
        
        db.commit()
        print(f"[AI LEARNING] Successfully learned from receipt {receipt_id}")

    except Exception as e:
        print(f"[AI LEARNING] Error during learning: {e}")
    finally:
        db.close()

def extract_keywords(text: str):
    """Simple keyword extractor: lowercase, alphanumeric, >2 chars, skip common stop words."""
    stop_words = {'the', 'and', 'for', 'with', 'from', 'this', 'that', 'items', 'item', 'total', 'price', 'amount'}
    
    # Normalize: lowercase and remove non-alphanumeric except spaces
    clean_text = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
    words = clean_text.split()
    
    keywords = set()
    for word in words:
        if len(word) > 2 and word not in stop_words:
            keywords.add(word)
    
    return keywords
