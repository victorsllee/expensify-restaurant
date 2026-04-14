import os
import re

DIR = '/Users/victorsllee/expensify-workspace/backend/app/api'
FILE_PATH = os.path.join(DIR, 'receipts.py')

with open(FILE_PATH, 'r') as f:
    content = f.read()

new_prompt_logic = """
def process_receipt_async(receipt_id: int, image_bytes: bytes, mime_type: str, user_id: str):
    \"\"\"Background task to run Gemini OCR and update the database.\"\"\"
    db = SessionLocal()
    try:
        receipt = db.query(models.Receipt).filter(models.Receipt.id == receipt_id).first()
        if not receipt:
            return

        # 1. Fetch Context (Categories, Vendors, Past Items)
        from app.api.categories import DEFAULT_CATEGORIES
        categories = db.query(models.Category).filter(models.Category.user_id == user_id).all()
        if not categories:
            for cat in DEFAULT_CATEGORIES:
                db.add(models.Category(user_id=user_id, name=cat["name"], color_code=cat["color_code"]))
            db.commit()
            categories = db.query(models.Category).filter(models.Category.user_id == user_id).all()
            
        category_names = [c.name for c in categories]
        
        vendors = db.query(models.Vendor).filter(models.Vendor.user_id == user_id).all()
        vendor_names = [v.name for v in vendors]
        
        # Get last 200 line items
        past_items = db.query(models.LineItem).join(models.Receipt).filter(
            models.Receipt.user_id == user_id, 
            models.LineItem.category_id != None
        ).order_by(models.LineItem.id.desc()).limit(200).all()
        
        past_mapping = {}
        for item in past_items:
            if item.description not in past_mapping and item.category:
                past_mapping[item.description] = item.category.name

        context_prompt = f\"\"\"
You are an expert OCR AI specifically trained to extract data from restaurant receipts and invoices.
Analyze the provided image and extract the information into a strictly formatted JSON object.

CONTEXT TO HELP YOU:
- Existing Vendors: {json.dumps(vendor_names)} (If the extracted vendor is a slight typo/variation of these, use the existing one to avoid duplicates).
- Available Categories: {json.dumps(category_names)} (You MUST map every line item to one of these exact categories, or null if absolutely unsure).
- Past Item Categorizations: {json.dumps(past_mapping)} (Use this as your primary source of truth for categorizing similar line items).

Extract:
1. "date": The date of the receipt (YYYY-MM-DD format). If not found, output null.
2. "vendor": The name of the store or vendor.
3. "total_amount": The grand total amount on the receipt (float).
4. "tax_amount": The total tax amount on the receipt (float). If not found, output 0.0.
5. "currency": The currency symbol or code (e.g., "$", "USD", "EUR").
6. "line_items": A list of objects, each containing:
   - "description": The name of the item.
   - "amount": The price of the item (float).
   - "category": The exact string name of the category from the Available Categories list (or null).
7. "confidence": A score between 0.0 and 1.0.

Important Rules:
- Return ONLY valid JSON.
- Do NOT wrap the output in markdown code blocks.
- All amounts should be numbers, not strings.

Expected JSON schema:
{{
  "date": "2023-10-27",
  "vendor": "Sysco",
  "total_amount": 150.50,
  "tax_amount": 10.50,
  "currency": "$",
  "line_items": [
    {{"description": "Chicken Breast", "amount": 50.00, "category": "Meat"}},
    {{"description": "Tomatoes", "amount": 25.00, "category": "Produce"}}
  ],
  "confidence": 0.95
}}
\"\"\"

        # Call Gemini for OCR extraction
        document = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[document, context_prompt],
            config=types.GenerateContentConfig(
                temperature=0.0,
            )
        )

        # Parse the JSON response
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        
        extracted_data = json.loads(raw_text)

        # Resolve Vendor with Multi-Tenancy
        vendor_name = extracted_data.get("vendor") or "Unknown Vendor"
        vendor = db.query(models.Vendor).filter(
            models.Vendor.name.ilike(vendor_name),
            models.Vendor.user_id == user_id
        ).first()
        
        if not vendor:
            vendor = models.Vendor(name=vendor_name, user_id=user_id)
            db.add(vendor)
            db.commit()
            db.refresh(vendor)
            
        # Resolve Date
        receipt_date = datetime.utcnow()
        if extracted_data.get("date"):
            try:
                receipt_date = datetime.strptime(extracted_data["date"], "%Y-%m-%d")
            except ValueError:
                pass

        # Update Receipt Record
        receipt.vendor_id = vendor.id
        receipt.total_amount = float(extracted_data.get("total_amount") or 0.0)
        receipt.tax_amount = float(extracted_data.get("tax_amount") or 0.0)
        receipt.date = receipt_date
        receipt.status = models.ReceiptStatus.PENDING # Ready for review queue

        # Create Line Items and calculate Main Category
        line_items_data = extracted_data.get("line_items", [])
        category_sums = {}
        
        for item in line_items_data:
            cat_name = item.get("category")
            cat_id = None
            if cat_name:
                cat = next((c for c in categories if c.name.lower() == cat_name.lower()), None)
                if cat:
                    cat_id = cat.id
                    amount = float(item.get("amount") or 0.0)
                    category_sums[cat_id] = category_sums.get(cat_id, 0) + amount
            
            new_line_item = models.LineItem(
                receipt_id=receipt.id,
                description=item.get("description", "Unknown Item"),
                amount=float(item.get("amount") or 0.0),
                category_id=cat_id
            )
            db.add(new_line_item)
            
        # Determine main category
        if category_sums:
            main_cat_id = max(category_sums.items(), key=lambda x: x[1])[0]
            receipt.main_category_id = main_cat_id
        
        db.commit()

    except Exception as e:
"""

# Replace the existing process_receipt_async block
new_content = re.sub(
    r'def process_receipt_async.*?except Exception as e:',
    new_prompt_logic,
    content,
    flags=re.DOTALL
)

with open(FILE_PATH, 'w') as f:
    f.write(new_content)
    
print("Updated receipts.py")
