from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class UserBase(BaseModel):
    phone_number: str
    role: str
    name: str
    province: Optional[str] = None
    address: Optional[str] = None
    commune: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # KYC
    nationality: Optional[str] = "Burundi"
    id_number: Optional[str] = None
    id_document_url: Optional[str] = None
    kyc_status: Optional[str] = "pending"
    
    # Fiscalité OBR
    nif_number: Optional[str] = None
    is_tax_payer: Optional[bool] = False

class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    phone_number: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    province: Optional[str] = None
    address: Optional[str] = None
    commune: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None
    
    # KYC
    nationality: Optional[str] = None
    id_number: Optional[str] = None
    id_document_url: Optional[str] = None
    kyc_status: Optional[str] = None

class User(UserBase):
    id: int
    balance: Decimal
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AdminUserSummary(User):
    orders: int = 0
    gmv: Decimal = Decimal("0.0")


class AuthSession(BaseModel):
    user_id: int
    role: str


class NotificationDismissRequest(BaseModel):
    notification_id: str


class AdminAgentCreate(BaseModel):
    phone_number: str
    name: str
    province: Optional[str] = "Bujumbura"


class AdminAgentSummary(BaseModel):
    id: int
    name: str
    phone_number: str
    province: Optional[str] = None


class PlatformSettingsBase(BaseModel):
    commission_rate: Decimal = Decimal("0.05")
    maintenance_mode: bool = False
    support_phone: str = "+25776000000"
    support_whatsapp: str = "+25776000000"


class PlatformSettingsUpdate(BaseModel):
    commission_rate: Optional[float] = None
    maintenance_mode: Optional[bool] = None
    support_phone: Optional[str] = None
    support_whatsapp: Optional[str] = None


class PublicPlatformSettings(PlatformSettingsBase):
    pass


class PublicTestimonial(BaseModel):
    id: int
    quote_fr: str
    quote_ki: str
    author_name: str
    author_role_fr: str
    author_role_ki: str
    location: Optional[str] = None
    rating: Decimal = Decimal("5.0")

    model_config = ConfigDict(from_attributes=True)


class TestimonialCreate(BaseModel):
    message: str
    rating: Decimal = Decimal("5.0")


class Testimonial(BaseModel):
    id: int
    quote_fr: str
    quote_ki: str
    author_name: str
    author_role_fr: str
    author_role_ki: str
    location: Optional[str] = None
    rating: Decimal
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminSettings(PlatformSettingsBase):
    updated_at: Optional[datetime] = None
    admins: List[AdminAgentSummary] = []


class SupportTicketCreate(BaseModel):
    phone_number: Optional[str] = None
    subject: str
    message: str


class SupportTicket(BaseModel):
    id: int
    user_id: Optional[int] = None
    subject: str
    message: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WalletWithdrawalRequest(BaseModel):
    user_id: int
    amount: Decimal
    channel: str = "Lumicash"
    phone_number: Optional[str] = None


class MockMobileMoneyPayoutRequest(BaseModel):
    provider: str = "Lumicash"
    phone_number: Optional[str] = None
    amount: Optional[float] = None
    withdrawal_id: Optional[int] = None
    fee_bearer: str = "recipient"


class MockMobileMoneyStatusUpdateRequest(BaseModel):
    note: Optional[str] = None


class MockMobileMoneyPayout(BaseModel):
    reference: str
    provider: str
    phone_number: str
    amount: Decimal
    currency: str = "BIF"
    fee_bearer: str
    provider_fee: Decimal
    tax_amount: Decimal
    net_amount: Decimal
    total_debited: Decimal
    status: str
    provider_transaction_id: Optional[str] = None
    linked_withdrawal_id: Optional[int] = None
    linked_withdrawal_reference: Optional[str] = None
    note: Optional[str] = None
    created_at: str
    updated_at: str


class AdminActionRequest(BaseModel):
    admin_user_id: Optional[int] = None
    note: Optional[str] = None


class AdminAuditEntry(BaseModel):
    id: str
    action: str
    title: str
    detail: str
    actorName: Optional[str] = None
    createdAt: str
    tone: str = "neutral"


class AdminWithdrawalSummary(BaseModel):
    id: str
    dbId: int
    farmerId: int
    farmerName: str
    farmerPhoneNumber: Optional[str] = None
    province: Optional[str] = None
    amount: Decimal
    channel: str
    phoneNumber: Optional[str] = None
    status: str
    note: Optional[str] = None
    createdAt: str
    processedAt: Optional[str] = None
    processedByUserId: Optional[int] = None
    processedByName: Optional[str] = None
    auditTrail: List[AdminAuditEntry] = []


class AdminTestimonialSummary(BaseModel):
    id: str
    dbId: int
    userId: Optional[int] = None
    authorName: str
    authorRoleFr: str
    authorRoleKi: str
    location: Optional[str] = None
    quoteFr: str
    quoteKi: str
    rating: Decimal = Decimal("5.0")
    status: str
    adminNote: Optional[str] = None
    createdAt: str
    reviewedAt: Optional[str] = None
    reviewedByUserId: Optional[int] = None
    reviewedByName: Optional[str] = None
    auditTrail: List[AdminAuditEntry] = []


class AdminFinanceAuditItem(BaseModel):
    id: str
    action: str
    title: str
    detail: str
    actorName: Optional[str] = None
    createdAt: str
    tone: str = "neutral"
    entityType: str
    entityId: Optional[int] = None
    entityLabel: Optional[str] = None
    reference: Optional[str] = None
    priority: str = "low"
    status: Optional[str] = None


class AdminFinanceAuditSummary(BaseModel):
    total: int = 0
    withdrawalEvents: int = 0
    disputeEvents: int = 0
    highPriorityEvents: int = 0
    pendingWithdrawalEvents: int = 0


class AdminFinanceAuditResponse(BaseModel):
    items: List[AdminFinanceAuditItem] = []
    summary: AdminFinanceAuditSummary

class ProductBase(BaseModel):
    name: str
    category: str
    price_per_kg: Decimal
    unit: str = "kg"
    quantity_kg: float
    min_stock: float = 10.0
    province: str
    vat_rate: Decimal = Decimal("0.18")
    is_taxable: bool = True

class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price_per_kg: Optional[float] = None
    unit: Optional[str] = None
    quantity_kg: Optional[float] = None
    min_stock: Optional[float] = None
    province: Optional[str] = None
    stock_reason_code: Optional[str] = None
    stock_reason_note: Optional[str] = None

class Product(ProductBase):
    id: int
    farmer_id: int
    farmer_name: Optional[str] = None
    sold_quantity: float
    image_url: Optional[str] = None
    rating: Decimal
    harvested_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockMovement(BaseModel):
    id: int
    product_id: Optional[int] = None
    farmer_id: int
    movement_type: str
    quantity_delta: float
    quantity_before: float
    quantity_after: float
    unit: str
    product_name_snapshot: str
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderBase(BaseModel):
    product_id: int
    quantity: float

class OrderCreate(OrderBase):
    pass

class Order(OrderBase):
    id: int
    buyer_id: int
    farmer_id: int
    driver_id: Optional[int] = None
    total_price: Decimal
    vat_amount: Decimal = Decimal("0.0")
    subtotal_price: Decimal = Decimal("0.0")
    invoice_number: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CartValidationItem(BaseModel):
    productId: int
    name: str
    price: Decimal
    quantity: float
    unit: str
    image_url: Optional[str] = None
    category: str


class CartValidationRequest(BaseModel):
    items: List[CartValidationItem]


class DisputeCreate(BaseModel):
    order_id: int
    reason: str
    detail: str
    refund_requested: Decimal
    priority: str = "medium"

class Dispute(DisputeCreate):
    id: int
    buyer_id: int
    farmer_id: int
    driver_id: Optional[int] = None
    amount: Decimal
    status: str
    resolution: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FarmerStats(BaseModel):
    balance: Decimal
    total_sales_bif: Decimal
    order_count: int
    pending_payout: Decimal
    weekly_sales: List[dict]

class AdminStats(BaseModel):
    gmv: Decimal
    active_farmers: int
    active_orders: int
    total_payouts: Decimal
    commission_rate: Decimal = Decimal("0.05")
    payout_beneficiaries: int = 0
    payout_releases: int = 0
    kpi_growth: dict = {}
    province_data: List[dict]
    monthly_gmv: List[dict] = []
    top_farmers: List[dict] = []
    recent_notifications: List[dict] = []
    open_disputes: int = 0
    unread_notifications: int = 0
    pending_withdrawals: int = 0
    pending_withdrawal_amount: Decimal = Decimal("0.0")
    completed_withdrawals: int = 0
    completed_withdrawal_amount: Decimal = Decimal("0.0")
    rejected_withdrawals: int = 0
    rejected_withdrawal_amount: Decimal = Decimal("0.0")
    total_withdrawal_requests: int = 0
    average_withdrawal_amount: Decimal = Decimal("0.0")
    in_review_disputes: int = 0
    resolved_disputes: int = 0
    high_priority_disputes: int = 0

class AdminFinanceAuditItem(BaseModel):
    id: str
    action: str
    title: str
    detail: str
    actorName: Optional[str] = None
    createdAt: str
    tone: str
    entityType: str
    entityId: Optional[int] = None
    entityLabel: Optional[str] = None
    reference: Optional[str] = None
    priority: str = "medium"
    status: Optional[str] = None

class AdminFinanceAuditResponse(BaseModel):
    items: List[AdminFinanceAuditItem]
    summary: dict = {
        "total": 0,
        "withdrawalEvents": 0,
        "disputeEvents": 0,
        "highPriorityEvents": 0,
        "pendingWithdrawalEvents": 0
    }

class Category(BaseModel):
    id: str
    label: str
    icon: str
    count: int

class AdminSettingsUpdate(BaseModel):
    commission_rate: Optional[float] = None
    maintenance_mode: Optional[bool] = None
    support_phone: Optional[str] = None
    support_whatsapp: Optional[str] = None

class AdminSettingsResponse(BaseModel):
    commission_rate: float
    maintenance_mode: bool
    support_phone: str
    support_whatsapp: str
    updated_at: Optional[datetime] = None
    admins: List[dict] = []
