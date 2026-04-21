from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
import os
import requests
from urllib.parse import urlencode

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

from app.services.zoho import push_receipt_to_zoho, get_zoho_access_token, get_zoho_merchants

router = APIRouter()

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "").strip('\"\'')
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "").strip('\"\'')
ZOHO_REDIRECT_URI = os.environ.get("ZOHO_REDIRECT_URI", "http://localhost:5173/settings").strip('\"\'')
ZOHO_SCOPE = "ZohoExpense.fullaccess.all"

@router.get("/merchants")
def list_zoho_merchants(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetches merchants from Zoho API."""
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if not settings or not settings.zoho_refresh_token:
        raise HTTPException(status_code=400, detail="Zoho not connected")
    
    try:
        access_token = get_zoho_access_token(settings.zoho_refresh_token)
        merchants = get_zoho_merchants(access_token)
        return {"status": "success", "data": merchants}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merchants/sync")
def sync_zoho_merchants(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Fetches merchants from Zoho and auto-maps existing local vendors by name."""
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if not settings or not settings.zoho_refresh_token:
        raise HTTPException(status_code=400, detail="Zoho not connected")
    
    try:
        access_token = get_zoho_access_token(settings.zoho_refresh_token)
        merchants = get_zoho_merchants(access_token)
        
        # Local vendors
        local_vendors = db.query(models.Vendor).filter(models.Vendor.user_id == user['uid']).all()
        
        synced_count = 0
        for zm in merchants:
            z_name = zm['merchant_name'].lower().strip()
            z_id = zm['merchant_id']
            
            # Find exact match
            for lv in local_vendors:
                if lv.name.lower().strip() == z_name:
                    if lv.zoho_merchant_id != z_id:
                        lv.zoho_merchant_id = z_id
                        synced_count += 1
        
        db.commit()
        return {"status": "success", "message": f"Successfully matched {synced_count} vendors from Zoho."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auth-url")

def get_zoho_auth_url():
    """Returns the URL the frontend should redirect the user to for Zoho OAuth"""
    if not ZOHO_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Zoho Client ID is not configured on the server.")
        
    params = {
        "response_type": "code",
        "client_id": ZOHO_CLIENT_ID,
        "scope": ZOHO_SCOPE,
        "redirect_uri": ZOHO_REDIRECT_URI,
        "access_type": "offline",
        "prompt": "consent" # Force consent to ensure we get a refresh_token
    }
    
    url = f"https://accounts.zoho.com/oauth/v2/auth?{urlencode(params)}"
    return {"url": url}

@router.post("/callback")
def handle_zoho_callback(
    code: str,
    user: dict = Depends(verify_token), 
    db: Session = Depends(get_db)
):
    """Exchanges the authorization code for a refresh token and saves it."""
    token_url = "https://accounts.zoho.com/oauth/v2/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "redirect_uri": ZOHO_REDIRECT_URI,
        "code": code
    }
    
    response = requests.post(token_url, data=data)
    if not response.ok:
        print("Zoho token exchange failed:", response.text)
        raise HTTPException(status_code=400, detail="Failed to authenticate with Zoho")
        
    token_data = response.json()
    refresh_token = token_data.get("refresh_token")
    
    if not refresh_token:
        # If Zoho doesn't send a refresh token, it means the user has authorized before and prompt=consent failed or wasn't sent.
        raise HTTPException(status_code=400, detail="No refresh token returned from Zoho. Try revoking the app access in Zoho and try again.")
        
    # Save the refresh token to the user's settings
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if not settings:
        settings = models.UserSettings(user_id=user['uid'])
        db.add(settings)
        
    settings.zoho_refresh_token = refresh_token
    settings.zoho_integration_enabled = True
    db.commit()
    
    return {"status": "success", "message": "Zoho connected successfully!"}

@router.delete("/disconnect")
def disconnect_zoho(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Disconnects the Zoho integration."""
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if settings:
        settings.zoho_refresh_token = None
        settings.zoho_integration_enabled = False
        db.commit()
        
    return {"status": "success", "message": "Zoho disconnected"}

@router.post("/resync/{receipt_id}")
def resync_receipt_to_zoho(
    receipt_id: int,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Manually re-triggers the Zoho sync for a specific receipt."""
    receipt = db.query(models.Receipt).filter(
        models.Receipt.id == receipt_id,
        models.Receipt.user_id == user['uid']
    ).first()

    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    if receipt.status != models.ReceiptStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved receipts can be synced.")

    # Reset sync-related errors before retrying
    receipt.error_message = None
    receipt.zoho_expense_id = None
    db.commit()

    # Use the same background task as the automatic sync
    from app.services.zoho import push_receipt_to_zoho
    background_tasks.add_task(push_receipt_to_zoho, receipt.id, user['uid'])

    return {"status": "success", "message": "Re-sync triggered successfully."}

