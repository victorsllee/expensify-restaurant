import os
import requests

def push_receipt_to_zoho(receipt, vendor, main_category, line_items, user_settings, db):
    """
    Background worker function that takes an APPROVED receipt and pushes it to Zoho Expense API.
    """
    if not user_settings or not user_settings.zoho_integration_enabled or not user_settings.zoho_refresh_token:
        return
        
    if receipt.zoho_expense_id:
        return # Already synced
        
    print(f"[ZOHO SYNC] Processing receipt {receipt.id} for user {receipt.user_id}")
    
    # TODO: In production, exchange the zoho_refresh_token for a short-lived access_token
    # access_token = exchange_token(user_settings.zoho_refresh_token)
    
    # Mocking the payload construction to show how it handles the toggle
    payload = {
        "date": receipt.date.strftime("%Y-%m-%d") if receipt.date else "",
        "merchant": vendor.name if vendor else "Unknown",
        "currency": receipt.currency or "USD",
        "total": receipt.total_amount,
        "tax_amount": receipt.tax_amount,
    }
    
    if receipt.track_line_items:
        # Itemized sync
        itemized_data = []
        for li in line_items:
            # Map our category ID to a Zoho Category ID if we had a mapping table
            cat_name = li.category.name if li.category else (main_category.name if main_category else "Uncategorized")
            itemized_data.append({
                "description": li.description,
                "amount": li.amount,
                "category_name": cat_name
            })
        payload["itemized_expenses"] = itemized_data
    else:
        # Aggregate sync
        payload["category_name"] = main_category.name if main_category else "Uncategorized"
        payload["description"] = f"{vendor.name if vendor else 'Vendor'} Order"
        
    print(f"[ZOHO SYNC] Payload constructed: {payload}")
    
    # Mock network request to Zoho
    # response = requests.post("https://expense.zoho.com/api/v1/expenses", json=payload, headers={"Authorization": f"Zoho-oauthtoken {access_token}"})
    
    # Mark as synced
    receipt.zoho_expense_id = f"zoho_mock_{receipt.id}"
    db.commit()
    print(f"[ZOHO SYNC] Success! Receipt {receipt.id} marked as synced.")