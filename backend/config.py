import os
from typing import Dict, List
from decimal import Decimal

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Endpoints d'amorçage e2e (/testing/*) : activés uniquement hors production.
E2E_TEST_MODE = (
    os.getenv("E2E_TEST_MODE", "false").strip().lower() == "true" and not IS_PRODUCTION
)

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

# Logistique Burundi
LOGISTICS_PRICE_PER_KM = Decimal("500.0") # BIF/km
LOGISTICS_FIXED_FEE_BUJUMBURA = Decimal("2000.0")
LOGISTICS_FIXED_FEE_PROVINCE = Decimal("5000.0")

# Saisons Agricoles Burundi
SAISONS = {
    "A": {"label": "Saison A (Sept-Jan)", "start_month": 9, "end_month": 1},
    "B": {"label": "Saison B (Fév-Juin)", "start_month": 2, "end_month": 6},
    "C": {"label": "Saison C (Juin-Sept)", "start_month": 6, "end_month": 9},
}

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
ORS_API_KEY = os.getenv("ORS_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Security
_DEFAULT_SECRET_KEY = "dev-secret-key-agriconnect-burundi-2026"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY)
if IS_PRODUCTION and SECRET_KEY == _DEFAULT_SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY doit être défini via la variable d'environnement en production."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Bootstrap du premier compte admin (sans accès shell, ex. Render plan gratuit).
# Voir routers/bootstrap.py : POST /bootstrap/admin avec X-Bootstrap-Secret.
# Se désactive automatiquement dès qu'un admin existe déjà en base.
ADMIN_BOOTSTRAP_SECRET = os.getenv("ADMIN_BOOTSTRAP_SECRET", "")

# OTP
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))

# SMS : "console" (simulateur, défaut), "twilio" ou "africastalking"
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console").strip().lower()
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
AFRICASTALKING_USERNAME = os.getenv("AFRICASTALKING_USERNAME", "")
AFRICASTALKING_API_KEY = os.getenv("AFRICASTALKING_API_KEY", "")
AFRICASTALKING_SENDER_ID = os.getenv("AFRICASTALKING_SENDER_ID", "")

# Mobile money : "mock" (défaut, paiement instantané simulé) ou "api"
# (agrégateur REST générique confirmé par webhook).
MOBILE_MONEY_PROVIDER = os.getenv("MOBILE_MONEY_PROVIDER", "mock").strip().lower()
MOBILE_MONEY_API_URL = os.getenv("MOBILE_MONEY_API_URL", "")
MOBILE_MONEY_API_KEY = os.getenv("MOBILE_MONEY_API_KEY", "")
MOBILE_MONEY_WEBHOOK_SECRET = os.getenv("MOBILE_MONEY_WEBHOOK_SECRET", "")
if IS_PRODUCTION and MOBILE_MONEY_PROVIDER == "api" and not MOBILE_MONEY_WEBHOOK_SECRET:
    raise RuntimeError(
        "MOBILE_MONEY_WEBHOOK_SECRET doit être défini quand MOBILE_MONEY_PROVIDER=api."
    )
