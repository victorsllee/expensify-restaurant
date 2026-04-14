from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

from app.api import users, receipts, review, history, analytics, categories, vendors, settings, zoho

# Initialize Firebase Admin
try:
    cred = credentials.Certificate('firebase-adminsdk.json')
    firebase_admin.initialize_app(cred)
except ValueError:
    pass # Already initialized

app = FastAPI(
    title="Expensify API",
    description="Backend for the Expensify Restaurant App",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, change to the frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(vendors.router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(zoho.router, prefix="/api/zoho", tags=["Zoho Integration"])
app.include_router(receipts.router, prefix="/api/receipts", tags=["Receipts"])
app.include_router(review.router, prefix="/api/review", tags=["Review Queue"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Expensify API is running"}

