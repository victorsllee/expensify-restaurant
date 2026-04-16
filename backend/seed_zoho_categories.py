from app.database import SessionLocal
from app.models import models

def seed_categories():
    db = SessionLocal()
    user_id = "XHPCmSSmecTqQl9pv4QjZBv28gm1" # Current user from logs
    
    zoho_categories = [
        {"name": "Fresh meat", "color": "#ef4444"},
        {"name": "Frozen", "color": "#3b82f6"},
        {"name": "Dairy", "color": "#f59e0b"},
        {"name": "Drinks", "color": "#8b5cf6"},
        {"name": "Rent", "color": "#6366f1"},
        {"name": "Utilities", "color": "#10b981"},
        {"name": "Supplies", "color": "#71717a"},
        {"name": "Maintenance", "color": "#f97316"}
    ]

    print(f"Seeding categories for user: {user_id}")
    
    for cat_data in zoho_categories:
        existing = db.query(models.Category).filter(
            models.Category.user_id == user_id,
            models.Category.name == cat_data["name"]
        ).first()
        
        if not existing:
            new_cat = models.Category(
                user_id=user_id,
                name=cat_data["name"],
                color_code=cat_data["color"]
            )
            db.add(new_cat)
            print(f"Created category: {cat_data['name']}")
        else:
            existing.color_code = cat_data["color"]
            print(f"Updated category color: {cat_data['name']}")
            
    db.commit()
    db.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed_categories()
