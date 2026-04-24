import os
from typing import Dict, List
from decimal import Decimal

# Session Configuration
SESSION_COOKIE_NAME = "agriconnect_session"
SESSION_USER_ID_KEY = "user_id"
SESSION_ROLE_KEY = "role"
SESSION_HTTPS_ONLY = os.getenv("SESSION_HTTPS_ONLY", "false").strip().lower() == "true"
SESSION_MAX_AGE = 7 * 24 * 60 * 60

# Business Constants
DEFAULT_COMMISSION_RATE = Decimal("0.05")
DEFAULT_SUPPORT_PHONE = "+25776000000"
DEFAULT_SUPPORT_WHATSAPP = "+25776000000"
MIN_WITHDRAWAL_AMOUNT = Decimal("10000.0")
AUTO_WITHDRAWAL_REVIEW_THRESHOLD = Decimal("25000.0")
WITHDRAWAL_REVIEW_SLA_HOURS = 24

# Roles
ROLE_ALIASES = {
    "acheteur": "acheteur",
    "buyer": "acheteur",
    "fermier": "fermier",
    "farmer": "fermier",
    "logistique": "logistique",
    "driver": "logistique",
    "admin": "admin",
}

BUYER_ROLE_VALUES = ["acheteur", "buyer"]
FARMER_ROLE_VALUES = ["fermier", "farmer"]
DRIVER_ROLE_VALUES = ["logistique", "driver"]
ADMIN_ROLE_VALUES = ["admin"]

# Finance
MOCK_MOBILE_MONEY_FEE_RATES = {
    "Lumicash": Decimal("0.01"),
    "Ecocash": Decimal("0.012"),
}
MOCK_MOBILE_MONEY_MIN_FEES = {
    "Lumicash": Decimal("150.0"),
    "Ecocash": Decimal("200.0"),
}
MOCK_MOBILE_MONEY_TAX_RATE = Decimal("0.18")

# CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-agriconnect-burundi-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
