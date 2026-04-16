from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .base import Base

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    user_id = Column(String, primary_key=True, index=True)
    default_currency = Column(String, default="$")
    zoho_integration_enabled = Column(Boolean, default=False)
    zoho_refresh_token = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

class ReceiptStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    color_code = Column(String, nullable=True) # e.g., "#FF5733"
    created_at = Column(DateTime, default=datetime.utcnow)

    receipts = relationship("Receipt", back_populates="main_category")
    line_items = relationship("LineItem", back_populates="category")

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False) # Multi-tenancy
    name = Column(String, index=True, nullable=False)
    default_category = Column(String, nullable=True)
    last_seen_at = Column(DateTime, default=datetime.utcnow)

    receipts = relationship("Receipt", back_populates="vendor")

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False) # Multi-tenancy
    image_url = Column(String, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    main_category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    currency = Column(String, nullable=True) # E.g. "$", "EUR"
    total_amount = Column(Float, nullable=True) # Now nullable during PROCESSING
    tax_amount = Column(Float, nullable=True)
    date = Column(DateTime, nullable=True) # Now nullable during PROCESSING
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.PROCESSING)
    error_message = Column(String, nullable=True)
    description = Column(String, nullable=True)
    track_line_items = Column(Boolean, default=False)
    zoho_expense_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="receipts")
    main_category = relationship("Category", back_populates="receipts")
    line_items = relationship("LineItem", back_populates="receipt", cascade="all, delete-orphan")

class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"))
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)

    receipt = relationship("Receipt", back_populates="line_items")
    category = relationship("Category", back_populates="line_items")

class CategoryLearning(Base):
    __tablename__ = 'category_learnings'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    keyword = Column(String, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False)
    frequency = Column(Integer, default=1)
    
    category = relationship("Category")

    __table_args__ = (
        UniqueConstraint('user_id', 'keyword', 'category_id', name='_user_keyword_category_uc'),
    )

