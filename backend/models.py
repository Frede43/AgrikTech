from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, UniqueConstraint, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import UTC, datetime
from backend.database import Base


def utcnow_naive():
    return datetime.now(UTC).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True)
    role = Column(String) # rôles canoniques: 'fermier', 'acheteur', 'logistique', 'admin'
    name = Column(String)
    province = Column(String, nullable=True)
    address = Column(String, nullable=True)
    commune = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    balance = Column(Numeric(12, 2), default=0.0) # Ikigega
    is_active = Column(Boolean, default=True)
    rating = Column(Float, default=4.5) # Note platforme (Burundi Soko Quality)
    
    # Fiscalité OBR (Burundi)
    nif_number = Column(String, nullable=True, index=True) # Numéro d'Identification Fiscale
    is_tax_payer = Column(Boolean, default=False)

    # KYC - Conformité BRB (Banque de la République du Burundi)
    nationality = Column(String, default="Burundi")
    id_number = Column(String, nullable=True, index=True) # CNI ou Passeport
    id_document_url = Column(String, nullable=True)
    kyc_status = Column(String, default="pending", index=True) # pending, approved, rejected
    kyc_reviewed_at = Column(DateTime, nullable=True)
    kyc_notes = Column(String, nullable=True)

    # Relationships
    products = relationship("Product", back_populates="farmer", foreign_keys="Product.farmer_id")
    
    orders_as_buyer = relationship("Order", back_populates="buyer", foreign_keys="Order.buyer_id")
    orders_as_farmer = relationship("Order", back_populates="farmer", foreign_keys="Order.farmer_id")
    orders_as_driver = relationship("Order", back_populates="driver", foreign_keys="Order.driver_id")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String, index=True)
    price_per_kg = Column(Numeric(12, 2))
    unit = Column(String, default="kg")
    vat_rate = Column(Numeric(5, 4), default=0.18) # TVA 18% par défaut au Burundi
    is_taxable = Column(Boolean, default=True)
    quantity_kg = Column(Float)
    min_stock = Column(Float, default=10.0)
    sold_quantity = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)
    province = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    rating = Column(Float, default=4.5)
    harvested_at = Column(DateTime, default=utcnow_naive)
    
    farmer_id = Column(Integer, ForeignKey("users.id"))
    farmer = relationship("User", back_populates="products", foreign_keys=[farmer_id])

    @hybrid_property
    def farmer_name(self):
        return self.farmer.name if self.farmer else "Inconnu"


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    movement_type = Column(String, nullable=False, index=True)
    quantity_delta = Column(Float, nullable=False)
    quantity_before = Column(Float, nullable=False)
    quantity_after = Column(Float, nullable=False)
    unit = Column(String, default="kg")
    product_name_snapshot = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)

    product = relationship("Product", foreign_keys=[product_id])
    farmer = relationship("User", foreign_keys=[farmer_id])

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"))
    farmer_id = Column(Integer, ForeignKey("users.id"))
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    total_price = Column(Numeric(12, 2)) # Prix TTC (Toutes Taxes Comprises)
    vat_amount = Column(Numeric(12, 2), default=0.0) # Montant de la TVA collectée
    subtotal_price = Column(Numeric(12, 2), default=0.0) # Prix HT (Hors Taxes)
    invoice_number = Column(String, unique=True, nullable=True, index=True) # N° Facture OBR
    status = Column(String, default="PENDING") 
    
    pickup_qr_token = Column(String, unique=True, index=True)
    delivery_otp = Column(String)

    created_at = Column(DateTime, default=utcnow_naive)

    # Relationships
    buyer = relationship("User", back_populates="orders_as_buyer", foreign_keys=[buyer_id])
    farmer = relationship("User", back_populates="orders_as_farmer", foreign_keys=[farmer_id])
    driver = relationship("User", back_populates="orders_as_driver", foreign_keys=[driver_id])
    product = relationship("Product")


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(String, nullable=False)
    detail  = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), default=0.0)
    refund_requested = Column(Numeric(12, 2), default=0.0)
    status = Column(String, default="open")
    priority = Column(String, default="medium")
    resolution = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    order = relationship("Order", foreign_keys=[order_id])
    buyer = relationship("User", foreign_keys=[buyer_id])
    farmer = relationship("User", foreign_keys=[farmer_id])
    driver = relationship("User", foreign_keys=[driver_id])


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transaction_log_id = Column(Integer, ForeignKey("transaction_logs.id"), nullable=True, unique=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    channel = Column(String, default="Lumicash")
    phone_number = Column(String, nullable=False)
    status = Column(String, default="pending", index=True)
    note = Column(String, nullable=True)
    processed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)
    processed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    processed_by = relationship("User", foreign_keys=[processed_by_user_id])
    transaction_log = relationship("TransactionLog", foreign_keys=[transaction_log_id])

class TransactionLog(Base):
    __tablename__ = "transaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) 
    amount = Column(Numeric(12, 2))
    timestamp = Column(DateTime, default=utcnow_naive)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    detail = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utcnow_naive, index=True)

    admin_user = relationship("User", foreign_keys=[admin_user_id])


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(Integer, primary_key=True, index=True)
    commission_rate = Column(Numeric(5, 4), default=0.05)
    maintenance_mode = Column(Boolean, default=False)
    support_phone = Column(String, default="+25776000000")
    support_whatsapp = Column(String, default="+25776000000")
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class Testimonial(Base):
    __tablename__ = "testimonials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    quote_fr = Column(String, nullable=False)
    quote_ki = Column(String, nullable=False)
    author_name = Column(String, nullable=False)
    author_role_fr = Column(String, nullable=False)
    author_role_ki = Column(String, nullable=False)
    location = Column(String, nullable=True)
    rating = Column(Numeric(3, 2), default=5.0)
    status = Column(String, default="approved", index=True)
    is_active = Column(Boolean, default=True, index=True)
    sort_order = Column(Integer, default=0, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    admin_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)

    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    channel = Column(String, default="app")
    subject = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="open")
    created_at = Column(DateTime, default=utcnow_naive)

    user = relationship("User", foreign_keys=[user_id])


class NotificationDismissal(Base):
    __tablename__ = "notification_dismissals"
    __table_args__ = (
        UniqueConstraint("user_id", "notification_id", name="uq_notification_dismissal_user_notification"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)

    user = relationship("User", foreign_keys=[user_id])


class PersistentSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True) # UUID session token
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])

class ProductReview(Base):
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    rating = Column(Integer, nullable=False) # 1 à 5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    product = relationship("Product", foreign_keys=[product_id])
    buyer = relationship("User", foreign_keys=[buyer_id])
    order = relationship("Order", foreign_keys=[order_id])

class LogisticsReview(Base):
    __tablename__ = "logistics_reviews"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True, index=True)
    rating = Column(Integer, nullable=False) # 1 à 5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    driver = relationship("User", foreign_keys=[driver_id])
    buyer = relationship("User", foreign_keys=[buyer_id])
    order = relationship("Order", foreign_keys=[order_id])

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    commission_rate = Column(Numeric(5, 4), default=0.05)
    maintenance_mode = Column(Boolean, default=False)
    support_phone = Column(String, default="+25776000000")
    support_whatsapp = Column(String, default="+25776000000")
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
