from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.auth import verify_token

router = APIRouter()

@router.get("/me")
def get_user_profile(user: dict = Depends(verify_token)):
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "name": user.get("name", "User"),
    }
