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
    kyc_status = Column(String, default="pending", index=True) # pending, verified, rejected
    kyc_reviewed_at = Column(DateTime, nullable=True)
    kyc_notes = Column(String, nullable=True)

    # Relationships
    products = relationship("Product", back_populates="farmer", foreign_keys="Product.farmer_id")
    
    orders_as_buyer = relationship("Order", back_populates="buyer", foreign_keys="Order.buyer_id")
    orders_as_farmer = relationship("Order", back_populates="farmer", foreign_keys="Order.farmer_id")
    orders_as_driver = relationship("Order", back_populates="driver", foreign_keys="Order.driver_id")

    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)
    cooperative = relationship("Cooperative", back_populates="members")

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
    trace_token = Column(String, unique=True, index=True, nullable=True) # UUID pour le QR Code de traçabilité
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)

    farmer = relationship("User", back_populates="products", foreign_keys=[farmer_id])
    cooperative = relationship("Cooperative")

    # Certification & Qualité
    certification = Column(String, nullable=True) # ex: "Bio", "ISABU", "Label Café Burundi"
    quality_grade = Column(String, nullable=True) # A, B, C
    lab_report_url = Column(String, nullable=True)

    @hybrid_property
    def seller_name(self):
        if self.cooperative:
            return self.cooperative.name
        return self.farmer.name if self.farmer else "Vendeur AgriConnect"


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
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    total_price = Column(Numeric(12, 2)) # Prix TTC (Toutes Taxes Comprises), inclut delivery_fee
    vat_amount = Column(Numeric(12, 2), default=0.0) # Montant de la TVA collectée (produits uniquement)
    subtotal_price = Column(Numeric(12, 2), default=0.0) # Prix HT (Hors Taxes), produits uniquement
    delivery_fee = Column(Numeric(12, 2), default=0.0) # Part de total_price versée au livreur (voir utils.compute_delivery_fee)
    invoice_number = Column(String, unique=True, nullable=True, index=True) # N° Facture OBR
    status = Column(String, default="PENDING") 
    
    pickup_qr_token = Column(String, unique=True, index=True)
    delivery_otp = Column(String)

    created_at = Column(DateTime, default=utcnow_naive)

    # Relationships
    buyer = relationship("User", back_populates="orders_as_buyer", foreign_keys=[buyer_id])
    farmer = relationship("User", back_populates="orders_as_farmer", foreign_keys=[farmer_id])
    driver = relationship("User", back_populates="orders_as_driver", foreign_keys=[driver_id])
    cooperative = relationship("Cooperative")
    product = relationship("Product")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


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
    pre_dispute_status = Column(String, nullable=True)
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
    support_email = Column(String, default="contact@agriconnect.bi")
    support_address = Column(String, default="Bujumbura, Burundi (Rohero II)")
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class Cooperative(Base):
    __tablename__ = "cooperatives"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    province = Column(String)
    commune = Column(String)
    contact_phone = Column(String)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow_naive)
    
    members = relationship("User", back_populates="cooperative")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    price_at_order = Column(Numeric(12, 2))
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product")

    @property
    def name(self):
        return self.product.name if self.product else "Produit inconnu"

    @property
    def unit(self):
        return self.product.unit if self.product else "kg"

    @property
    def image_url(self):
        return self.product.image_url if self.product else None

    @property
    def lineTotal(self):
        from decimal import Decimal
        p = self.price_at_order or 0
        q = self.quantity or 0
        return Decimal(str(p)) * Decimal(str(q))

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    content = Column(String, nullable=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

class Equipment(Base):
    __tablename__ = "equipments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String) # tracteur, pompe, etc.
    owner_id = Column(Integer, ForeignKey("users.id"))
    price_per_day = Column(Numeric(12, 2))
    province = Column(String)
    is_available = Column(Boolean, default=True)
    image_url = Column(String, nullable=True)
    
    owner = relationship("User")

class EquipmentReservation(Base):
    __tablename__ = "equipment_reservations"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String, default="pending") # pending, confirmed, completed, cancelled
    total_price = Column(Numeric(12, 2))
    created_at = Column(DateTime, default=utcnow_naive)

class CreditRequest(Base):
    __tablename__ = "credit_requests"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount_requested = Column(Numeric(12, 2))
    reason = Column(String)
    status = Column(String, default="pending") # pending, approved, rejected, repaid
    harvest_estimate_kg = Column(Float, nullable=True)
    product_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    reviewed_at = Column(DateTime, nullable=True)

class OtpCode(Base):
    """Code OTP persisté : survit aux redémarrages et fonctionne multi-workers."""
    __tablename__ = "otp_codes"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    last_sent_at = Column(DateTime, default=utcnow_naive, nullable=False)
