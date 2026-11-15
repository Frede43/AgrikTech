import os
from typing import Dict, List
from decimal import Decimal
from urllib.parse import urlparse

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT not in {"development", "dev", "test", "testing", "local"}

# Endpoints d'amorçage e2e : activés uniquement en test sur la base Playwright dédiée.
_e2e_database_url = os.getenv("DATABASE_URL", "").strip().lower().replace("\\", "/")
_e2e_database_name = os.path.basename(_e2e_database_url.split("?", 1)[0].rstrip("/"))
E2E_TEST_MODE = (
    os.getenv("E2E_TEST_MODE", "false").strip().lower() == "true"
    and ENVIRONMENT == "test"
    and _e2e_database_url.startswith("sqlite")
    and _e2e_database_name == "agriconnect.e2e.db"
)

# Session Configuration
SESSION_COOKIE_NAME = "agriconnect_session"
SESSION_USER_ID_KEY = "user_id"
SESSION_ROLE_KEY = "role"
SESSION_HTTPS_ONLY = os.getenv(
    "SESSION_HTTPS_ONLY", "true" if IS_PRODUCTION else "false"
).strip().lower() == "true"
# "lax" convient en dev (front/back sur localhost = même site). En prod,
# front (Vercel) et back (Render) sont des domaines différents (cross-site) :
# un cookie SameSite=Lax n'est jamais renvoyé sur les fetch() cross-site,
# il faut "none" — ce qui exige aussi Secure (HTTPS), sinon les navigateurs
# rejettent le cookie silencieusement.
SESSION_SAMESITE = os.getenv(
    "SESSION_SAMESITE", "none" if IS_PRODUCTION else "lax"
).strip().lower()
if SESSION_SAMESITE == "none" and not SESSION_HTTPS_ONLY:
    SESSION_SAMESITE = "lax"
if IS_PRODUCTION and not SESSION_HTTPS_ONLY:
    raise RuntimeError("SESSION_HTTPS_ONLY doit être activé hors développement/test.")
if IS_PRODUCTION and SESSION_SAMESITE != "none":
    raise RuntimeError("SESSION_SAMESITE doit être 'none' pour le frontend distant en HTTPS.")
SESSION_MAX_AGE = 7 * 24 * 60 * 60

# Business Constants
DEFAULT_COMMISSION_RATE = Decimal("0.05")
# Taux promotionnel d'onboarding : abaisse la barrière à l'entrée pour un
# nouveau fermier (au Burundi, les intermédiaires informels prennent souvent
# 15-30% — 2% sur les premières ventes prouve la valeur avant d'en extraire).
# S'applique aux N premières ventes livrées de CHAQUE fermier (voir
# payment_service.release_funds_to_farmer), pas à une fenêtre calendaire :
# reste valable pour tout nouveau fermier, quelle que soit sa date d'inscription.
PROMO_COMMISSION_RATE = Decimal("0.02")
PROMO_SALES_THRESHOLD = 20
DEFAULT_SUPPORT_PHONE = "+25776000000"
DEFAULT_SUPPORT_WHATSAPP = "+25776000000"
DEFAULT_SUPPORT_EMAIL = "contact@agriconnect.bi"
DEFAULT_SUPPORT_ADDRESS = "Bujumbura, Burundi (Rohero II)"
MIN_WITHDRAWAL_AMOUNT = Decimal("10000.0")
AUTO_WITHDRAWAL_REVIEW_THRESHOLD = Decimal("25000.0")
WITHDRAWAL_REVIEW_SLA_HOURS = 24

# Catégories de produits temporairement bloquées à la création, en attendant
# clarification réglementaire. "export" (café/thé) : le café est régulé de
# bout en bout par l'ODECA (ex-ARFIC, État burundais depuis 2020) — production,
# transformation ET commercialisation — et le thé suit un schéma comparable
# via l'OTB. Retirer "export" de cette liste dès que le statut est clarifié.
RESTRICTED_PRODUCT_CATEGORIES = {"export"}

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
# obr / ministere_agriculture : comptes gouvernementaux en lecture, créés par
# un admin (pas d'auto-inscription publique, comme "admin").
ROLE_ALIASES = {
    "acheteur": "acheteur",
    "buyer": "acheteur",
    "fermier": "fermier",
    "farmer": "fermier",
    "logistique": "logistique",
    "driver": "logistique",
    "admin": "admin",
    "obr": "obr",
    "ministere_agriculture": "ministere_agriculture",
}

BUYER_ROLE_VALUES = ["acheteur", "buyer"]
FARMER_ROLE_VALUES = ["fermier", "farmer"]
DRIVER_ROLE_VALUES = ["logistique", "driver"]
ADMIN_ROLE_VALUES = ["admin"]
OBR_ROLE_VALUES = ["obr"]
MINISTRY_ROLE_VALUES = ["ministere_agriculture"]
# Rôles créés uniquement par un admin (comme "admin"), jamais via
# l'inscription publique — voir backend/services/user_service.py.
GOVERNMENT_ROLE_VALUES = OBR_ROLE_VALUES + MINISTRY_ROLE_VALUES

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

# Stockage des fichiers uploadés (images produit, documents KYC). Sans ces
# clés, backend/services/file_storage_service.py se rabat sur le disque
# local — à réserver au développement : le disque d'un service Render
# gratuit est réinitialisé à chaque redéploiement (voir sa docstring).
IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY", "")
IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY", "")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")
if IS_PRODUCTION and IMAGEKIT_URL_ENDPOINT:
    parsed_imagekit_endpoint = urlparse(IMAGEKIT_URL_ENDPOINT)
    if (
        parsed_imagekit_endpoint.scheme != "https"
        or not parsed_imagekit_endpoint.hostname
        or parsed_imagekit_endpoint.query
        or parsed_imagekit_endpoint.fragment
    ):
        raise RuntimeError("IMAGEKIT_URL_ENDPOINT doit utiliser HTTPS avec un hôte valide.")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
# CORS : FRONTEND_URL accepte une liste d'origines séparées par des virgules
# (ex: "https://techagriapp.netlify.app,https://agrik-tech-blond.vercel.app")
# — utile en particulier pendant une migration d'hébergeur, le temps que
# l'ancien domaine reste actif en parallèle du nouveau.
FRONTEND_URLS = [origin.strip().rstrip("/") for origin in FRONTEND_URL.split(",") if origin.strip()]


def _is_https_origin(origin: str) -> bool:
    parsed = urlparse(origin)
    try:
        parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and parsed.path in ("", "/")
        and not parsed.query
        and not parsed.fragment
        and parsed.username is None
        and parsed.password is None
    )


if IS_PRODUCTION and (
    not FRONTEND_URLS
    or any(not _is_https_origin(origin) for origin in FRONTEND_URLS)
):
    raise RuntimeError("FRONTEND_URL doit contenir uniquement des origines HTTPS valides hors développement/test.")

# Security
_DEFAULT_SECRET_KEY = "dev-secret-key-agriconnect-burundi-2026"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY)
if IS_PRODUCTION and (SECRET_KEY == _DEFAULT_SECRET_KEY or len(SECRET_KEY) < 32):
    raise RuntimeError(
        "SECRET_KEY doit contenir au moins 32 caractères et être défini via l'environnement de production."
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

# L'accès aux données privées USSD reste fermé tant que la passerelle et
# l'application ne partagent pas un secret aléatoire configuré hors du code.
USSD_WEBHOOK_SECRET = os.getenv("USSD_WEBHOOK_SECRET", "")
if IS_PRODUCTION and USSD_WEBHOOK_SECRET and len(USSD_WEBHOOK_SECRET) < 32:
    raise RuntimeError("USSD_WEBHOOK_SECRET doit contenir au moins 32 caractères.")

# SMS : "console" (simulateur, défaut), "twilio" ou "africastalking"
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console" if not IS_PRODUCTION else "").strip().lower()
if IS_PRODUCTION and SMS_PROVIDER not in ("twilio", "africastalking"):
    raise RuntimeError(
        "SMS_PROVIDER doit désigner un fournisseur réel (twilio ou africastalking) hors développement/test."
    )
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
AFRICASTALKING_USERNAME = os.getenv("AFRICASTALKING_USERNAME", "")
AFRICASTALKING_API_KEY = os.getenv("AFRICASTALKING_API_KEY", "")
AFRICASTALKING_SENDER_ID = os.getenv("AFRICASTALKING_SENDER_ID", "")

# Mobile money : "mock" (défaut, paiement instantané simulé) ou "api"
# (agrégateur REST générique confirmé par webhook).
MOBILE_MONEY_PROVIDER = os.getenv(
    "MOBILE_MONEY_PROVIDER", "api" if IS_PRODUCTION else "mock"
).strip().lower()
MOBILE_MONEY_API_URL = os.getenv("MOBILE_MONEY_API_URL", "")
MOBILE_MONEY_API_KEY = os.getenv("MOBILE_MONEY_API_KEY", "")
MOBILE_MONEY_WEBHOOK_SECRET = os.getenv("MOBILE_MONEY_WEBHOOK_SECRET", "")
if IS_PRODUCTION:
    if MOBILE_MONEY_PROVIDER != "api":
        raise RuntimeError("Le fournisseur mobile money simulé est interdit hors développement/test.")
    if not (MOBILE_MONEY_API_URL and MOBILE_MONEY_API_KEY and MOBILE_MONEY_WEBHOOK_SECRET):
        raise RuntimeError(
            "MOBILE_MONEY_API_URL, MOBILE_MONEY_API_KEY et MOBILE_MONEY_WEBHOOK_SECRET sont requis hors développement/test."
        )
    if len(MOBILE_MONEY_WEBHOOK_SECRET) < 32:
        raise RuntimeError("MOBILE_MONEY_WEBHOOK_SECRET doit contenir au moins 32 caractères.")
    parsed_mobile_money_url = urlparse(MOBILE_MONEY_API_URL)
    if parsed_mobile_money_url.scheme != "https" or not parsed_mobile_money_url.hostname:
        raise RuntimeError("MOBILE_MONEY_API_URL doit utiliser HTTPS avec un nom d'hôte valide.")
    if SMS_PROVIDER == "twilio" and not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        raise RuntimeError("Les identifiants Twilio complets sont requis pour l'envoi d'OTP.")
    if SMS_PROVIDER == "africastalking" and not (AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY):
        raise RuntimeError("Les identifiants Africa's Talking sont requis pour l'envoi d'OTP.")
