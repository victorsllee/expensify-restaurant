from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import os
import json
from google.cloud import storage
from google import genai
from google.genai import types

from app.api.auth import verify_token
from app.database import get_db, SessionLocal
from app.models import models

router = APIRouter()

# Initialize Gemini Client globally
gemini_api_key = os.environ.get("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

# OCR Prompt Definition
RECEIPT_OCR_PROMPT = """
You are an expert OCR AI specifically trained to extract data from restaurant receipts and invoices.
Analyze the provided image and extract the following information into a strictly formatted JSON object.

Extract:
1. "date": The date of the receipt (YYYY-MM-DD format). If not found, output null.
2. "vendor": The name of the store or vendor.
3. "total_amount": The grand total amount on the receipt (float).
4. "tax_amount": The total tax amount on the receipt (float). If not found, output 0.0.
5. "currency": The currency symbol or code (e.g., "$", "USD", "EUR").
6. "line_items": A list of objects, each containing:
   - "description": The name of the item.
   - "amount": The price of the item (float).
7. "confidence": A score between 0.0 and 1.0 indicating how confident you are in the accuracy of the extraction (especially for messy handwriting or blurry images).

Important Rules:
- Return ONLY valid JSON.
- Do NOT wrap the output in markdown code blocks (like ```json ... ```).
- All amounts should be numbers, not strings.

Expected JSON schema:
{
  "date": "2023-10-27",
  "vendor": "Sysco",
  "total_amount": 150.50,
  "tax_amount": 10.50,
  "currency": "$",
  "line_items": [
    {"description": "Chicken Breast", "amount": 50.00},
    {"description": "Tomatoes", "amount": 25.00}
  ],
  "confidence": 0.95
}
"""


def process_receipt_async(receipt_id: int, image_bytes: bytes, mime_type: str, user_id: str):
    """Background task to run Gemini OCR and update the database."""
    db = SessionLocal()
    try:
        receipt = db.query(models.Receipt).filter(models.Receipt.id == receipt_id).first()
        if not receipt:
            return

        # 1. Fetch Context (Categories, Vendors, Learned Memory)
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
        
        # Get learned mappings from memory (top frequency)
        learnings = db.query(models.CategoryLearning).filter(
            models.CategoryLearning.user_id == user_id
        ).order_by(models.CategoryLearning.frequency.desc()).limit(100).all()
        
        learned_hints = {}
        for l in learnings:
            if l.keyword not in learned_hints:
                learned_hints[l.keyword] = l.category.name

        context_prompt = f"""
You are an expert OCR AI specifically trained to extract data from restaurant receipts and invoices.
Analyze the provided image and extract the information into a strictly formatted JSON object.

CRITICAL CONTEXT & RULES:
1. PREDEFINED CATEGORIES: {json.dumps(category_names)}
   - You MUST map every line item to one of these EXACT strings.
   - Do NOT invent new categories.
2. EXISTING VENDORS: {json.dumps(vendor_names)}
   - If the receipt vendor is a variation or typo of one of these, use the EXACT name from this list.
3. LEARNED BEHAVIOR (HINTS): {json.dumps(learned_hints)}
   - If a line item description contains one of these keywords, prioritize the associated category.

Extract:
1. "date": The date of the receipt (YYYY-MM-DD format). If not found, output null.
2. "vendor": The name of the store or vendor.
3. "total_amount": The grand total amount on the receipt (float).
4. "tax_amount": The total tax amount on the receipt (float). If not found, output 0.0.
5. "currency": The currency symbol or code (e.g., "$", "USD", "EUR").
6. "line_items": A list of objects, each containing:
   - "description": The name of the item.
   - "amount": The price of the item (float).
   - "category": The exact string name from the PREDEFINED CATEGORIES list above (or null).
7. "confidence": A score between 0.0 and 1.0.

Important: Return ONLY valid JSON. No markdown. No commentary.
"""

        # Call Gemini for OCR extraction
        if gemini_client is None:
            raise Exception("GEMINI_API_KEY is missing or invalid.")
        document = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[document, context_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                )
            )
        except Exception as api_err:
            print(f"Primary model failed ({api_err}). Retrying with gemini-2.5-flash...")
            if gemini_client is None:
                raise Exception("GEMINI_API_KEY is missing or invalid.")
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

        # Retrieve user settings for default currency
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
        default_currency = user_settings.default_currency if user_settings else "$"
        
        extracted_currency = extracted_data.get("currency")
        final_currency = extracted_currency if extracted_currency else default_currency

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
        receipt.currency = final_currency
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

        import traceback
        traceback.print_exc()
        db.rollback()
        receipt = db.query(models.Receipt).filter(models.Receipt.id == receipt_id).first()
        if receipt:
            receipt.status = models.ReceiptStatus.FAILED
            receipt.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/upload")
async def upload_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Handles file upload and creates a PROCESSING receipt record instantly."""
    try:
        user_id = user['uid']

        # 1. Initialize Google Cloud Storage
        gcp_creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "gcp-service-account.json")
        try:
            if os.path.exists(gcp_creds_path):
                storage_client = storage.Client.from_service_account_json(gcp_creds_path)
            else:
                storage_client = storage.Client()
        except Exception as e:
            print(f"Warning: Could not initialize GCP Storage: {e}")
            storage_client = storage.Client()

        bucket_name = "expensify-receipts-victors" 
        bucket = storage_client.bucket(bucket_name)

        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"receipts/{user_id}/{uuid.uuid4()}{file_extension}"
        
        blob = bucket.blob(unique_filename)
        contents = await file.read()
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        image_url = blob.public_url

        # 2. Create Receipt Record in PROCESSING state
        new_receipt = models.Receipt(
            user_id=user_id,
            image_url=image_url,
            status=models.ReceiptStatus.PROCESSING
        )
        db.add(new_receipt)
        db.commit()
        db.refresh(new_receipt)

        # 3. Trigger Background Task for AI OCR
        background_tasks.add_task(process_receipt_async, new_receipt.id, contents, file.content_type, user_id)

        return {
            "status": "success",
            "message": "Receipt uploaded successfully and is being processed.",
            "receipt_id": new_receipt.id,
            "image_url": image_url,
            "system_status": new_receipt.status.value
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
