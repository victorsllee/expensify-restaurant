from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import verify_token
from app.database import get_db
from app.models import models

router = APIRouter()

class SettingsUpdate(BaseModel):
    default_currency: str
    zoho_integration_enabled: bool
    zoho_refresh_token: str | None = None

@router.get("")
def get_settings(user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if not settings:
        settings = models.UserSettings(user_id=user['uid'], default_currency="$", zoho_integration_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return {
        "default_currency": settings.default_currency,
        "zoho_integration_enabled": settings.zoho_integration_enabled,
        "zoho_refresh_token": "********" if settings.zoho_refresh_token else ""
    }

@router.put("")
def update_settings(data: SettingsUpdate, user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user['uid']).first()
    if not settings:
        settings = models.UserSettings(
            user_id=user['uid'], 
            default_currency=data.default_currency,
            zoho_integration_enabled=data.zoho_integration_enabled,
            zoho_refresh_token=data.zoho_refresh_token if data.zoho_refresh_token and data.zoho_refresh_token != "********" else None
        )
        db.add(settings)
    else:
        settings.default_currency = data.default_currency
        settings.zoho_integration_enabled = data.zoho_integration_enabled
        if data.zoho_refresh_token and data.zoho_refresh_token != "********":
            settings.zoho_refresh_token = data.zoho_refresh_token
            
    db.commit()
    return {"status": "success", "default_currency": settings.default_currency}