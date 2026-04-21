from typing import List
import os
import requests
import json

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")

def get_zoho_access_token(refresh_token: str) -> str:
    """Exchanges the refresh token for a short-lived access token."""
    url = "https://accounts.zoho.com/oauth/v2/token"
    data = {
        "refresh_token": refresh_token,
        "client_id": ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "grant_type": "refresh_token"
    }
    response = requests.post(url, data=data)
    response.raise_for_status()
    return response.json().get("access_token")

def normalize_currency(currency: str) -> str:
    """Maps common currency symbols to ISO 4217 codes."""
    mapping = {
        "₫": "VND",
        "đ": "VND",
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₩": "KRW",
        "S$": "SGD",
        "RM": "MYR"
    }
    return mapping.get(currency, currency).upper()

_zoho_currencies_cache = None

def get_zoho_currencies(access_token: str) -> List[dict]:
    """Fetches the list of currencies from Zoho and caches it."""
    global _zoho_currencies_cache
    if _zoho_currencies_cache is not None:
        return _zoho_currencies_cache

    print("[ZOHO SYNC] Fetching available currencies from Zoho...")
    url = "https://www.zohoapis.com/expense/v1/settings/currencies"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        _zoho_currencies_cache = response.json().get("currencies", [])
        print(f"[ZOHO SYNC] Found {len(_zoho_currencies_cache)} currencies.")
        return _zoho_currencies_cache
    except Exception as e:
        print(f"[ZOHO SYNC] Error fetching currencies: {e}")
        return []


from app.database import SessionLocal
from app.models import models

def get_zoho_merchants(access_token: str) -> List[dict]:
    """Fetches the list of merchants/vendors from Zoho."""
    print("[ZOHO] Fetching merchants from Zoho...")
    url = "https://www.zohoapis.com/expense/v1/merchants"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        merchants = response.json().get("merchants", [])
        print(f"[ZOHO] Found {len(merchants)} merchants.")
        return merchants
    except Exception as e:
        print(f"[ZOHO] Error fetching merchants: {e}")
        return []

def push_receipt_to_zoho(receipt_id: int, user_id: str):
    """
    Background worker function that takes an APPROVED receipt and pushes it to Zoho Expense API.
    """
    db = SessionLocal()
    receipt = None
    try:
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
        if not user_settings or not user_settings.zoho_integration_enabled or not user_settings.zoho_refresh_token:
            return
            
        receipt = db.query(models.Receipt).filter(models.Receipt.id == receipt_id).first()
        if not receipt or receipt.zoho_expense_id:
            return # Already synced or not found
            
        vendor = db.query(models.Vendor).filter(models.Vendor.id == receipt.vendor_id).first() if receipt.vendor_id else None
        main_category = db.query(models.Category).filter(models.Category.id == receipt.main_category_id).first() if receipt.main_category_id else None
        line_items = db.query(models.LineItem).filter(models.LineItem.receipt_id == receipt.id).all()
        
        print(f"[ZOHO SYNC] Processing receipt {receipt.id} for user {receipt.user_id}")
    
        access_token = get_zoho_access_token(user_settings.zoho_refresh_token)
        
        # Get currency ID from Zoho
        currencies = get_zoho_currencies(access_token)
        currency_id = None
        target_currency = normalize_currency(receipt.currency or "USD")
        for c in currencies:
            if c['currency_code'] == target_currency:
                currency_id = c['currency_id']
                break
        
        if not currency_id:
            print(f"[ZOHO SYNC] Currency code '{target_currency}' not found in Zoho account.")
            receipt.error_message = f"Zoho Sync Failed: Currency '{target_currency}' is not enabled in your Zoho Expense account."
            db.commit()
            return

        # Prepare receipt file
        files = None
        if receipt.image_url:
            try:
                img_res = requests.get(receipt.image_url)
                if img_res.ok:
                    content_type = img_res.headers.get("Content-Type", "image/jpeg")
                    ext = content_type.split("/")[-1]
                    if ext == "pdf":
                        filename = f"receipt_{receipt.id}.pdf"
                    else:
                        filename = f"receipt_{receipt.id}.{ext if ext != 'jpeg' else 'jpg'}"
                    
                    files = {
                        'receipt': (filename, img_res.content, content_type)
                    }
                    print(f"[ZOHO SYNC] Attachment prepared: {filename}")
            except Exception as img_err:
                print(f"[ZOHO SYNC] Failed to download attachment: {img_err}")

        # Prepare merchant name/id
        merchant_name = vendor.name if vendor else "Unknown"
        merchant_id = vendor.zoho_merchant_id if vendor else None

        # Zoho Expense API typically expects a specific payload format for expenses
        # Ref: https://www.zoho.com/expense/api/v1/expenses/#create-an-expense
        expense_data = {
            "date": receipt.date.strftime("%Y-%m-%d") if receipt.date else "",
            "amount": receipt.total_amount or 0.0,
            "merchant_name": merchant_name,
            "currency_id": currency_id,
            "tax_amount": receipt.tax_amount or 0.0,
            "description": receipt.description or f"Receipt from {merchant_name}"
        }
        
        if merchant_id:
            expense_data["merchant_id"] = merchant_id
        
        if receipt.track_line_items and line_items:
            # Zoho supports itemized expenses
            itemized_data = []
            for li in line_items:
                cat_name = li.category.name if li.category else (main_category.name if main_category else "Uncategorized")
                itemized_data.append({
                    "description": li.description,
                    "amount": li.amount,
                    "category_name": cat_name
                })
            expense_data["itemized_details"] = itemized_data
        else:
            # Aggregate sync
            expense_data["category_name"] = main_category.name if main_category else "Uncategorized"
            
        print(f"[ZOHO SYNC] Payload constructed: {json.dumps(expense_data)}")
        
        # We need to wrap the payload in "JSONString" for zoho v1 api
        data = {
            "JSONString": json.dumps(expense_data)
        }
        
        headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
        
        if files:
            response = requests.post("https://www.zohoapis.com/expense/v1/expenses", data=data, files=files, headers=headers)
        else:
            response = requests.post("https://www.zohoapis.com/expense/v1/expenses", data=data, headers=headers)
        
        if response.ok:
            data = response.json()
            # Zoho API v1 for expenses creation usually returns an array of expenses in 'expenses'
            # or a single 'expense' object depending on exact version/endpoint.
            expense_id = None
            if "expense" in data and isinstance(data["expense"], dict):
                expense_id = data["expense"].get("expense_id")
            elif "expenses" in data and isinstance(data["expenses"], list) and len(data["expenses"]) > 0:
                expense_id = data["expenses"][0].get("expense_id")
                
            receipt.zoho_expense_id = str(expense_id) if expense_id else f"zoho_success_{receipt.id}"
            db.commit()
            print(f"[ZOHO SYNC] Success! Receipt {receipt.id} marked as synced. Zoho ID: {receipt.zoho_expense_id}")
        else:
            print(f"[ZOHO SYNC] Error from Zoho API: {response.status_code} - {response.text}")
            receipt.error_message = f"Zoho Sync Failed: {response.text}"
            db.commit()
            
    except Exception as e:
        print(f"[ZOHO SYNC] Exception during sync: {str(e)}")
        if receipt is not None:
            receipt.error_message = f"Zoho Sync Exception: {str(e)}"
            db.commit()
    finally:
        db.close()