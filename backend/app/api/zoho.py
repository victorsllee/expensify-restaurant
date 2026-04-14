from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import os
import requests
from urllib.parse import urlencode

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
# e.g., http://localhost:5173/settings
ZOHO_REDIRECT_URI = os.environ.get("ZOHO_REDIRECT_URI", "http://localhost:5173/settings")

# Scope required for Zoho Expense
ZOHO_SCOPE = "ZohoExpense.receipts.CREATE,ZohoExpense.receipts.READ,ZohoExpense.receipts.UPDATE,ZohoExpense.receipts.DELETE,ZohoExpense.settings.READ"

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
