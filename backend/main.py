from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

if __package__ in (None, ""):
    # Exécution directe (`python main.py` depuis backend/) : la racine du projet
    # doit être sur sys.path pour que le paquet `backend` soit importable.
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine
import backend.models as models
import backend.config as config
from backend.routers import (
    auth, market, admin, products, orders, wallet, disputes, community,
    categories, stats, users, testimonials, notifications, platform,
    support, reviews, cart, stock_movements, weather, cooperatives,
    equipment, messages, credits, obr, payments, bootstrap
)

# En mode test e2e, on repart d'une base vierge à chaque démarrage du serveur
# (schéma toujours à jour, données des runs précédents purgées).
if config.E2E_TEST_MODE:
    models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AgriConnect Burundi API", description="Backend pour le projet AgriConnect Burundi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(wallet.router)
app.include_router(disputes.router)
app.include_router(community.router)
app.include_router(categories.router)
app.include_router(stats.router)
app.include_router(users.router)
app.include_router(testimonials.router)
app.include_router(notifications.router)
app.include_router(platform.router)
app.include_router(support.router)
app.include_router(reviews.router)
app.include_router(cart.router)
app.include_router(stock_movements.router)
app.include_router(weather.router)
app.include_router(cooperatives.router)
app.include_router(equipment.router)
app.include_router(messages.router)
app.include_router(credits.router)
app.include_router(obr.router)
app.include_router(payments.router)
app.include_router(bootstrap.router)

if config.E2E_TEST_MODE:
    from backend.routers import testing as testing_router
    app.include_router(testing_router.router)

@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    # HEAD est explicitement supporté : c'est ce que le frontend utilise
    # pour son ping de connectivité (lib/offline.ts), FastAPI ne l'ajoute
    # pas automatiquement pour une route déclarée en GET seul.
    return {"status": "ok"}

# Chemin absolu (dérivé de __file__, pas du CWD du process) : products.py et
# users.py écrivent déjà leurs uploads dans backend/static/uploads/... via ce
# même calcul. Un chemin relatif "static" ici pointait vers <CWD>/static —
# différent de backend/static dès que le process démarre depuis la racine du
# projet (cas réel : `uvicorn backend.main:app` sur Render) — les fichiers
# uploadés atterrissaient dans un dossier jamais servi, 404 systématique.
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API AgriConnect Burundi", "status": "online"}


# =============================================================================
# FACADE SERVICE LAYER
# =============================================================================

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Optional, List
import uuid, random, string, math
from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import defaultdict

import backend.schemas as schemas
from backend.models import utcnow_naive

# ── In-memory state ──────────────────────────────────────────────────────────
pending_otps: dict = {}
auth_sessions: dict = {}
mock_mobile_money_payouts: dict = {}

# ── Constants ─────────────────────────────────────────────────────────────────
ORDER_STATUS_PAID_ESCROW = "PAID_ESCROW"
ORDER_STATUS_PICKED_UP = "PICKED_UP"
ORDER_STATUS_COMPLETED = "COMPLETED"
ORDER_STATUS_DISPUTED = "DISPUTED"
DEFAULT_COMMISSION_RATE = float(config.DEFAULT_COMMISSION_RATE)
DEFAULT_SUPPORT_PHONE = config.DEFAULT_SUPPORT_PHONE
DEFAULT_SUPPORT_WHATSAPP = config.DEFAULT_SUPPORT_WHATSAPP
SESSION_COOKIE_NAME = config.SESSION_COOKIE_NAME
UPLOAD_DIR = "static/uploads"

_VALID_ROLES = set(config.ROLE_ALIASES.values())

_STATUS_DISPLAY = {
    "PAID_ESCROW": "pending", "PICKED_UP": "collected",
    "COMPLETED": "delivered", "DISPUTED": "disputed",
    "PENDING": "pending", "TRANSIT": "transit",
}
_STATUS_DASHBOARD = {
    "PAID_ESCROW": "preparation", "PICKED_UP": "collected",
    "COMPLETED": "delivered", "DISPUTED": "disputed",
    "TRANSIT": "transit", "PENDING": "preparation",
}

# ── Internal helpers ──────────────────────────────────────────────────────────

def _normalize_role(role: str) -> str:
    return config.ROLE_ALIASES.get(role, role)

def _get_system_settings(db: Session) -> models.SystemSettings:
    s = db.query(models.SystemSettings).first()
    if not s:
        s = models.SystemSettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

def _get_commission_rate(db: Session) -> Decimal:
    s = db.query(models.SystemSettings).first()
    if s and s.commission_rate is not None:
        return Decimal(str(s.commission_rate))
    return config.DEFAULT_COMMISSION_RATE

def _build_address(user: models.User) -> str:
    parts = [p for p in [user.address, user.commune, user.province] if p]
    return ", ".join(parts) if parts else (user.province or "")

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def _session_user_id(request) -> Optional[int]:
    token = request.cookies.get(SESSION_COOKIE_NAME) if request else None
    if not token or token not in auth_sessions:
        return None
    return auth_sessions[token]["user_id"]

def _require_auth(request) -> dict:
    token = request.cookies.get(SESSION_COOKIE_NAME) if request else None
    if not token or token not in auth_sessions:
        raise HTTPException(status_code=401)
    return auth_sessions[token]

def _get_dismissed_ids(user_id: int, db: Session) -> set:
    rows = db.query(models.NotificationDismissal.notification_id).filter(
        models.NotificationDismissal.user_id == user_id
    ).all()
    return {r[0] for r in rows}

def _safe_growth(current, prev) -> float:
    c = float(str(current or 0))
    p = float(str(prev or 0))
    if p == 0:
        return 100.0 if c > 0 else 0.0
    return round(((c - p) / p) * 100, 1)

def format_testimonial_reference(testimonial_id: int) -> str:
    return f"TST-{testimonial_id:05d}"

def _format_dispute_reference(dispute_id: int) -> str:
    return f"DIS-{dispute_id}"

def _format_withdrawal_reference(wr_id: int) -> str:
    return f"WDR-{wr_id}"

def _notif_time(dt) -> str:
    return dt.isoformat() if dt else utcnow_naive().isoformat()

# ─────────────────────── USER ────────────────────────────────────────────────

def create_user(payload: schemas.UserCreate, *, db: Session) -> models.User:
    role = _normalize_role(payload.role)
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rôle invalide: {payload.role}")
    existing = db.query(models.User).filter(models.User.phone_number == payload.phone_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Numéro déjà enregistré.")
    user = models.User(
        phone_number=payload.phone_number, role=role, name=payload.name,
        province=payload.province, address=payload.address, commune=payload.commune,
        latitude=payload.latitude, longitude=payload.longitude,
        balance=Decimal("0.0"), is_active=True,
        nationality=payload.nationality or "Burundi", kyc_status="pending",
        id_number=payload.id_number, id_document_url=payload.id_document_url,
        nif_number=payload.nif_number, is_tax_payer=payload.is_tax_payer or False,
        cooperative_id=payload.cooperative_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def read_user(user_id: int, *, db: Session) -> models.User:
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return u

def get_users(*, db: Session) -> List[dict]:
    users = db.query(models.User).all()
    result = []
    for u in users:
        if u.role in config.FARMER_ROLE_VALUES:
            orders = db.query(func.count(models.Order.id)).filter(models.Order.farmer_id == u.id).scalar() or 0
            gmv = float(str(db.query(func.sum(models.Order.total_price)).filter(models.Order.farmer_id == u.id).scalar() or 0))
        elif u.role in config.BUYER_ROLE_VALUES:
            orders = db.query(func.count(models.Order.id)).filter(models.Order.buyer_id == u.id).scalar() or 0
            gmv = float(str(db.query(func.sum(models.Order.total_price)).filter(models.Order.buyer_id == u.id).scalar() or 0))
        elif u.role in config.DRIVER_ROLE_VALUES:
            orders = db.query(func.count(models.Order.id)).filter(models.Order.driver_id == u.id).scalar() or 0
            gmv = 0.0
        else:
            orders = 0
            gmv = 0.0
        result.append({"id": u.id, "name": u.name, "role": u.role, "phone_number": u.phone_number,
                        "province": u.province, "is_active": u.is_active, "orders": orders, "gmv": gmv})
    return result

def update_user(user_id: int, payload: schemas.UserUpdate, *, db: Session) -> models.User:
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404)
    if payload.is_active is False and u.role == "admin":
        raise HTTPException(status_code=400, detail="Impossible de désactiver un compte admin.")
    if payload.phone_number:
        dup = db.query(models.User).filter(
            models.User.phone_number == payload.phone_number, models.User.id != user_id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="Numéro déjà utilisé.")
        u.phone_number = payload.phone_number
    if payload.role is not None:
        u.role = _normalize_role(payload.role)
    for field in ("name", "province", "address", "commune", "latitude", "longitude",
                  "nationality", "id_number", "id_document_url", "kyc_status", "nif_number"):
        val = getattr(payload, field, None)
        if val is not None:
            setattr(u, field, val)
    if payload.is_active is not None:
        u.is_active = payload.is_active
    db.commit()
    db.refresh(u)
    return u

def delete_user(user_id: int, *, db: Session):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404)
    if u.role == "admin":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un compte admin.")
    has_orders = db.query(models.Order.id).filter(
        (models.Order.farmer_id == user_id) | (models.Order.buyer_id == user_id)
    ).first()
    if has_orders:
        raise HTTPException(status_code=400, detail="Utilisateur lié à des commandes.")
    db.delete(u)
    db.commit()

def create_admin_agent(payload: schemas.AdminAgentCreate, *, db: Session) -> models.User:
    existing = db.query(models.User).filter(models.User.phone_number == payload.phone_number).first()
    if existing:
        existing.role = "admin"
        db.commit()
        db.refresh(existing)
        return existing
    user = models.User(
        phone_number=payload.phone_number, role="admin", name=payload.name,
        province=payload.province, balance=Decimal("0.0"), is_active=True, kyc_status="pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# ─────────────────────── PRODUCT ─────────────────────────────────────────────

def create_product(payload: schemas.ProductCreate, *, farmer_id: int, db: Session) -> models.Product:
    farmer = db.query(models.User).filter(models.User.id == farmer_id).first()
    if not farmer or farmer.role not in config.FARMER_ROLE_VALUES:
        raise HTTPException(status_code=403, detail="Accès réservé aux fermiers.")
    qty = float(payload.quantity_kg)
    p = models.Product(
        name=payload.name, category=payload.category,
        price_per_kg=Decimal(str(payload.price_per_kg)),
        unit=payload.unit or "kg", quantity_kg=0,  # start at 0 for correct stock movement
        min_stock=payload.min_stock if payload.min_stock is not None else 10.0,
        province=payload.province, farmer_id=farmer_id,
        vat_rate=Decimal(str(payload.vat_rate or "0.18")),
        is_taxable=payload.is_taxable if payload.is_taxable is not None else True,
        certification=payload.certification, quality_grade=payload.quality_grade,
        lab_report_url=payload.lab_report_url, cooperative_id=payload.cooperative_id,
        trace_token=str(uuid.uuid4()),
    )
    db.add(p)
    db.flush()
    db.add(models.StockMovement(
        product_id=p.id, farmer_id=p.farmer_id,
        movement_type="initial_stock", quantity_delta=qty,
        quantity_before=0, quantity_after=qty,
        unit=p.unit or "kg", product_name_snapshot=p.name,
        reason="Stock initial",
    ))
    p.quantity_kg = qty
    db.commit()
    db.refresh(p)
    return p

def get_product(product_id: int, *, db: Session) -> models.Product:
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404)
    p.farmer_name = p.farmer.name if p.farmer else "Vendeur AgriConnect"
    return p

def read_products(skip: int = 0, limit: int = 20, *, category: Optional[str] = None,
                  province: Optional[str] = None, farmer_id: Optional[int] = None,
                  db: Session) -> List[models.Product]:
    q = db.query(models.Product)
    if category:
        q = q.filter(models.Product.category == category)
    if province:
        q = q.filter(models.Product.province == province)
    if farmer_id is not None:
        q = q.filter(models.Product.farmer_id == farmer_id)
    return q.offset(skip).limit(limit).all()

_REASON_TO_TYPE = {
    "stock_return": "stock_return",
    "order_cancellation": "order_cancel_return",
    "damage": "damage",
}
_INCREASE_ONLY = {"stock_return", "order_cancellation"}
_DECREASE_ONLY = {"damage"}

def update_product(product_id: int, payload: schemas.ProductUpdate, *, farmer_id: int, db: Session) -> models.Product:
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404)
    if p.farmer_id != farmer_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    if payload.quantity_kg is not None:
        old_qty = float(p.quantity_kg or 0)
        new_qty = float(payload.quantity_kg)
        delta = new_qty - old_qty
        reason_code = payload.stock_reason_code
        reason_note = payload.stock_reason_note or ""

        if reason_code in _INCREASE_ONLY and delta < 0:
            raise HTTPException(status_code=400, detail=f"Le code '{reason_code}' nécessite une augmentation de stock.")
        if reason_code in _DECREASE_ONLY and delta > 0:
            raise HTTPException(status_code=400, detail=f"Le code '{reason_code}' nécessite une réduction de stock.")

        movement_type = _REASON_TO_TYPE.get(reason_code, "manual_adjustment") if reason_code else "manual_adjustment"
        if movement_type == "stock_return":
            reason_text = f"Retour de stock{': ' + reason_note if reason_note else ''}"
        elif movement_type == "order_cancel_return":
            reason_text = f"Retour après annulation de commande{': ' + reason_note if reason_note else ''}"
        elif movement_type == "damage":
            reason_text = f"Avarie de stock{': ' + reason_note if reason_note else ''}"
        else:
            reason_text = f"Ajustement manuel{': ' + reason_note if reason_note else ''}"

        db.add(models.StockMovement(
            product_id=p.id, farmer_id=p.farmer_id,
            movement_type=movement_type, quantity_delta=delta,
            quantity_before=old_qty, quantity_after=new_qty,
            unit=p.unit or "kg", product_name_snapshot=p.name,
            reason=reason_text,
        ))
        p.quantity_kg = new_qty

    for field in ("name", "category", "price_per_kg", "image_url", "is_active", "min_stock", "province"):
        val = getattr(payload, field, None)
        if val is not None:
            setattr(p, field, val)

    db.commit()
    db.refresh(p)
    return p

def delete_product(product_id: int, *, farmer_id: int, db: Session):
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404)
    if p.farmer_id != farmer_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    db.delete(p)
    db.commit()

def read_stock_movements(*, farmer_id: int, product_id: Optional[int] = None,
                         limit: int = 100, db: Session) -> List[models.StockMovement]:
    q = db.query(models.StockMovement).filter(models.StockMovement.farmer_id == farmer_id)
    if product_id is not None:
        q = q.filter(models.StockMovement.product_id == product_id)
    return q.order_by(models.StockMovement.created_at.desc()).limit(limit).all()

async def upload_file(upload_file) -> dict:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(upload_file.filename or "file.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    content = await upload_file.read()
    with open(path, "wb") as f:
        f.write(content)
    return {"url": f"/static/uploads/{filename}"}

async def upload_product_image(product_id: int, upload_file, *, db: Session) -> dict:
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(upload_file.filename or "image.jpg")[1] or ".jpg"
    filename = f"prod_{product_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    content = await upload_file.read()
    with open(path, "wb") as f:
        f.write(content)
    url = f"/static/uploads/{filename}"
    p.image_url = url
    db.commit()
    return {"status": "Image téléchargée avec succès", "image_url": url}

def get_categories(*, db: Session) -> List[dict]:
    rows = db.query(
        models.Product.category,
        func.count(models.Product.id).label("cnt")
    ).filter(models.Product.quantity_kg > 0).group_by(models.Product.category).all()
    return [{"id": cat, "label": cat.capitalize(), "icon": "🌿", "count": cnt}
            for cat, cnt in rows if cat]

def get_live_prices(province: Optional[str] = None, *, db: Session) -> List[dict]:
    province_filter = province.strip() if province and province.strip() else None
    history_cutoff = utcnow_naive() - timedelta(days=7)

    q = db.query(models.Product).filter(models.Product.quantity_kg > 0)
    if province_filter:
        q = q.filter(func.lower(models.Product.province) == province_filter.lower())
    active_products = q.all()

    # Get canonical (properly-cased) province name from DB
    if province_filter and active_products:
        canonical_province = active_products[0].province
    elif province_filter:
        canonical_province = province_filter.title()
    else:
        canonical_province = None

    by_name: dict = defaultdict(list)
    for p in active_products:
        by_name[p.name].append(p)

    result = []
    for product_name, products in by_name.items():
        total_qty = sum(float(p.quantity_kg) for p in products)
        if total_qty == 0:
            continue
        weighted_price = sum(float(str(p.price_per_kg)) * float(p.quantity_kg) for p in products) / total_qty
        active_listings = len(products)
        provinces_count = len({p.province for p in products if p.province})

        hist_q = db.query(models.OrderItem.price_at_order).join(
            models.Order, models.OrderItem.order_id == models.Order.id
        ).join(
            models.Product, models.OrderItem.product_id == models.Product.id
        ).filter(
            models.Product.name == product_name,
            models.Order.status == ORDER_STATUS_COMPLETED,
            models.Order.created_at < history_cutoff,
        )
        if province_filter:
            hist_q = hist_q.filter(func.lower(models.Product.province) == province_filter.lower())
        hist_prices = [float(str(r[0])) for r in hist_q.all()]

        if hist_prices:
            avg_hist = sum(hist_prices) / len(hist_prices)
            change = round(((weighted_price - avg_hist) / avg_hist) * 100, 1)
            trend = "up" if change > 0 else ("down" if change < 0 else "stable")
        else:
            avg_hist = None
            change = 0.0
            trend = "stable"

        abs_change = abs(change)
        volatility = "high" if abs_change > 20 else ("medium" if abs_change > 10 else "low")
        sample_size = active_listings + len(hist_prices)
        confidence_score = min(100, sample_size * 20)
        confidence_label = "high" if confidence_score >= 60 else ("medium" if confidence_score >= 30 else "low")
        recommended_action = "sell" if trend == "up" else ("buy" if trend == "down" else "hold")

        market_scope = "province" if canonical_province else "national"
        market_scope_label = canonical_province if canonical_province else "Burundi"

        result.append({
            "product": product_name,
            "price": round(weighted_price, 2),
            "trend": trend,
            "change": change,
            "active_listings": active_listings,
            "sample_size": sample_size,
            "confidence_score": confidence_score,
            "confidence_label": confidence_label,
            "volatility": volatility,
            "recommended_action": recommended_action,
            "pricing_basis": "active_listings",
            "source": "marketplace",
            "market_scope": market_scope,
            "market_scope_label": market_scope_label,
            "provinces": provinces_count,
        })

    return result

def validate_cart(payload: schemas.CartValidationRequest, *, db: Session) -> dict:
    items = []
    all_valid = True
    available_total = 0.0

    for cart_item in payload.items:
        product = db.query(models.Product).filter(models.Product.id == cart_item.productId).first()
        if not product:
            items.append({"productId": cart_item.productId, "status": "not_found",
                          "validated_quantity": 0, "issues": "Produit introuvable."})
            all_valid = False
            continue

        current_price = float(str(product.price_per_kg))
        cart_price = float(str(cart_item.price))
        current_qty = float(product.quantity_kg or 0)
        cart_qty = float(cart_item.quantity)

        issue_parts = []
        if abs(current_price - cart_price) > 0.01:
            issue_parts.append("Le prix a changé")

        validated_qty = min(cart_qty, current_qty)
        if current_qty < cart_qty:
            issue_parts.append("Stock insuffisant")
            all_valid = False
            status = "stock_changed"
        elif issue_parts:
            status = "price_changed"
            all_valid = False
        else:
            status = "ok"

        available_total += validated_qty * current_price

        issues_str = ". ".join(issue_parts) + ("." if issue_parts else "")
        items.append({
            "productId": cart_item.productId,
            "status": status,
            "validated_quantity": validated_qty,
            "available_quantity": current_qty,
            "current_price": current_price,
            "issues": issue_parts,
        })

    return {"valid": all_valid, "items": items, "available_total": available_total}

def get_weather() -> dict:
    return {
        "location": "Province de Kayanza",
        "forecast": [
            {"day": "Lun", "condition": "Ensoleillé", "temp_high": 24, "temp_low": 16, "humidity": 55},
            {"day": "Mar", "condition": "Nuageux", "temp_high": 22, "temp_low": 15, "humidity": 65},
            {"day": "Mer", "condition": "Pluie légère", "temp_high": 20, "temp_low": 14, "humidity": 80},
            {"day": "Jeu", "condition": "Ensoleillé", "temp_high": 23, "temp_low": 15, "humidity": 58},
            {"day": "Ven", "condition": "Nuageux", "temp_high": 21, "temp_low": 14, "humidity": 70},
        ],
    }

def get_agri_tips() -> List[dict]:
    return [
        {"title": "Préparation de la saison des pluies", "body": "Préparez vos canaux de drainage avant les premières pluies.", "urgency": "high"},
        {"title": "Fertilisation naturelle", "body": "Utilisez du compost pour améliorer la qualité de vos sols.", "urgency": "medium"},
        {"title": "Rotation des cultures", "body": "Alternez les légumineuses avec les céréales pour enrichir le sol.", "urgency": "low"},
    ]

# ─────────────────────── ORDER ────────────────────────────────────────────────

def _gen_qr() -> str:
    return "QR-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=12))

def _gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

def create_order(payload: schemas.OrderCreate, *, buyer_id: int, db: Session) -> models.Order:
    settings = _get_system_settings(db)
    if settings.maintenance_mode:
        raise HTTPException(status_code=503, detail="Plateforme en maintenance.")

    buyer = db.query(models.User).filter(models.User.id == buyer_id).first()
    if not buyer or buyer.role not in config.BUYER_ROLE_VALUES:
        raise HTTPException(status_code=403, detail="Accès réservé aux acheteurs.")

    if payload.product_id is not None:
        product_id = payload.product_id
        quantity = float(payload.quantity or 1)
    elif payload.items:
        product_id = payload.items[0].product_id
        quantity = float(payload.items[0].quantity)
    else:
        raise HTTPException(status_code=400, detail="Commande invalide.")

    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    if float(product.quantity_kg or 0) < quantity:
        raise HTTPException(status_code=400, detail="Stock insuffisant.")

    price = Decimal(str(product.price_per_kg))
    total = price * Decimal(str(quantity))
    vat_rate = Decimal(str(product.vat_rate or "0.18"))
    vat_amount = total * vat_rate if product.is_taxable else Decimal("0")

    order = models.Order(
        buyer_id=buyer_id, farmer_id=product.farmer_id,
        product_id=product_id, quantity=quantity,
        total_price=total, vat_amount=vat_amount, subtotal_price=total,
        status=ORDER_STATUS_PAID_ESCROW,
        pickup_qr_token=_gen_qr(), delivery_otp=_gen_otp(),
    )
    db.add(order)
    db.flush()

    db.add(models.OrderItem(
        order_id=order.id, product_id=product_id,
        quantity=quantity, price_at_order=price,
    ))

    before = float(product.quantity_kg or 0)
    product.quantity_kg = before - quantity
    product.sold_quantity = float(product.sold_quantity or 0) + quantity

    db.add(models.StockMovement(
        product_id=product.id, farmer_id=product.farmer_id,
        movement_type="order_out", quantity_delta=-quantity,
        quantity_before=before, quantity_after=float(product.quantity_kg),
        unit=product.unit or "kg", product_name_snapshot=product.name,
        reason=f"Commande #{order.id}",
    ))

    db.commit()
    db.refresh(order)
    return order

def pickup_order(order_id: int, qr_token: str, driver_id: int, *, db: Session) -> dict:
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404)
    driver = db.query(models.User).filter(models.User.id == driver_id).first()
    if not driver or driver.role not in config.DRIVER_ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Rôle livreur requis.")
    if order.status != ORDER_STATUS_PAID_ESCROW:
        raise HTTPException(status_code=400, detail="Statut invalide pour la collecte.")
    if order.pickup_qr_token != qr_token:
        raise HTTPException(status_code=400, detail="QR code invalide.")
    order.status = ORDER_STATUS_PICKED_UP
    order.driver_id = driver_id
    db.commit()
    return {"status": ORDER_STATUS_PICKED_UP}

def deliver_order(order_id: int, otp: str, *, db: Session) -> dict:
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404)
    if order.status != ORDER_STATUS_PICKED_UP:
        raise HTTPException(status_code=400, detail="La commande n'est pas en transit.")
    if order.delivery_otp != otp:
        raise HTTPException(status_code=403, detail="OTP invalide.")
    commission_rate = _get_commission_rate(db)
    total = Decimal(str(order.total_price))
    farmer_credited = total * (1 - commission_rate)
    commission = total * commission_rate
    order.status = ORDER_STATUS_COMPLETED
    farmer = db.query(models.User).filter(models.User.id == order.farmer_id).first()
    if farmer:
        farmer.balance = Decimal(str(farmer.balance or 0)) + farmer_credited
    db.add(models.TransactionLog(
        order_id=order.id, user_id=order.farmer_id,
        action="FUNDS_RELEASED", amount=farmer_credited,
    ))
    db.commit()
    return {"farmer_credited": float(str(farmer_credited)), "agriconnect_commission": float(str(commission))}

def get_order_detail(order_id: int, *, db: Session) -> dict:
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404)
    status = _STATUS_DISPLAY.get(order.status, order.status.lower() if order.status else "")
    farmer = order.farmer
    buyer = order.buyer
    product = order.product

    def coords(u):
        if u and u.latitude is not None and u.longitude is not None:
            return f"{u.latitude:.5f}, {u.longitude:.5f}"
        return None

    items = []
    if product:
        items.append({"name": product.name, "qty": order.quantity, "unit": product.unit or "kg",
                      "price_per_unit": float(str(product.price_per_kg))})
    else:
        for item in order.items:
            p = item.product
            items.append({"name": p.name if p else "?", "qty": item.quantity,
                          "unit": p.unit if p else "kg", "price_per_unit": float(str(item.price_at_order))})

    total_weight = sum(i["qty"] for i in items)
    farmer_addr = _build_address(farmer) if farmer else ""
    buyer_addr = _build_address(buyer) if buyer else ""
    instructions = f"Livrer à: {buyer_addr}" if buyer_addr else "Instructions de livraison non disponibles."

    farmer_info = {"id": farmer.id, "name": farmer.name, "phone": farmer.phone_number,
                   "address": farmer_addr} if farmer else {}
    if farmer and coords(farmer):
        farmer_info["coordinates"] = coords(farmer)
    buyer_info = {"id": buyer.id, "name": buyer.name, "phone": buyer.phone_number,
                  "address": buyer_addr} if buyer else {}
    if buyer and coords(buyer):
        buyer_info["coordinates"] = coords(buyer)

    return {
        "orderId": f"CMD-{order.id}", "status": status,
        "farmer": farmer_info, "buyer": buyer_info,
        "driver": {"id": order.driver_id, "name": order.driver.name} if order.driver else None,
        "items": items, "totalWeight": f"{total_weight}kg",
        "total_price": float(str(order.total_price)),
        "instructions": instructions,
        "pickup_qr": order.pickup_qr_token, "delivery_otp": order.delivery_otp,
    }

def get_buyer_orders(buyer_id: int, *, db: Session) -> List[dict]:
    orders = db.query(models.Order).filter(
        models.Order.buyer_id == buyer_id
    ).order_by(models.Order.created_at.desc()).all()
    result = []
    for o in orders:
        product = o.product
        items = []
        if product:
            items.append({"name": product.name, "qty": o.quantity, "unit": product.unit or "kg"})
        else:
            for item in o.items:
                p = item.product
                items.append({"name": p.name if p else "?", "qty": item.quantity})
        result.append({
            "id": o.id,
            "status": _STATUS_DISPLAY.get(o.status, o.status.lower() if o.status else ""),
            "driver": {"name": o.driver.name} if o.driver else None,
            "pickup_qr": o.pickup_qr_token, "delivery_otp": o.delivery_otp,
            "items": items, "total_price": float(str(o.total_price)),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return result

def get_logistics_orders(*, status: Optional[str] = None, db: Session) -> List[dict]:
    _reverse = {
        "delivered": ORDER_STATUS_COMPLETED, "collected": ORDER_STATUS_PICKED_UP,
        "pending": ORDER_STATUS_PAID_ESCROW,
    }
    q = db.query(models.Order)
    if status:
        db_status = _reverse.get(status)
        if db_status:
            q = q.filter(models.Order.status == db_status)
    else:
        # default: exclude completed orders
        q = q.filter(models.Order.status != ORDER_STATUS_COMPLETED)
    orders = q.order_by(models.Order.created_at.desc()).all()
    result = []
    for o in orders:
        farmer = o.farmer
        buyer = o.buyer
        product = o.product
        farmer_addr = _build_address(farmer) if farmer else ""
        buyer_addr = _build_address(buyer) if buyer else ""

        distance = "À confirmer"
        if (farmer and farmer.latitude and farmer.longitude and
                buyer and buyer.latitude and buyer.longitude):
            dist_km = _haversine(farmer.latitude, farmer.longitude, buyer.latitude, buyer.longitude)
            distance = f"{dist_km:.1f} km"

        result.append({
            "id": o.id,
            "status": _STATUS_DISPLAY.get(o.status, o.status.lower() if o.status else ""),
            "farmer": farmer.name if farmer else "",
            "buyer": buyer.name if buyer else "",
            "address": farmer_addr, "buyer_address": buyer_addr,
            "distance": distance,
            "pickup_qr": o.pickup_qr_token, "delivery_otp": o.delivery_otp,
            "product": product.name if product else "",
            "quantity": o.quantity, "total_price": float(str(o.total_price)),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return result

def get_user_transactions(user_id: int, *, db: Session) -> List[dict]:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.role not in config.FARMER_ROLE_VALUES:
        return []
    commission_rate = _get_commission_rate(db)
    rows = []

    wrs = db.query(models.WithdrawalRequest).filter(
        models.WithdrawalRequest.user_id == user_id
    ).all()
    for wr in wrs:
        rows.append({
            "_sort_key": wr.created_at,
            "id": f"WDR-{wr.id}",
            "type": "payout", "status": wr.status,
            "channel": wr.channel, "destination_phone": wr.phone_number,
            "order_id": None, "order_reference": None, "pickup_qr": None,
            "buyer": f"Retrait {wr.channel or 'Lumicash'}",
            "items": f"Vers {wr.phone_number}",
            "date": wr.created_at.isoformat()[:10] if wr.created_at else "",
            "gross": float(str(wr.amount)), "commission": 0,
            "net": -float(str(wr.amount)),
            "note": wr.note or "",
        })

    active_orders = db.query(models.Order).filter(
        models.Order.farmer_id == user_id,
        models.Order.status == ORDER_STATUS_PAID_ESCROW,
    ).all()
    for o in active_orders:
        product = o.product
        gross = float(str(o.total_price))
        comm = gross * float(str(commission_rate))
        net = gross - comm
        rows.append({
            "_sort_key": o.created_at,
            "id": f"ORDER-{o.id}",
            "type": "sale", "status": "pending",
            "channel": None, "destination_phone": None,
            "order_id": o.id, "order_reference": f"CMD-{o.id}",
            "pickup_qr": o.pickup_qr_token,
            "buyer": o.buyer.name if o.buyer else "",
            "items": product.name if product else "",
            "date": o.created_at.isoformat()[:10] if o.created_at else "",
            "gross": gross, "commission": comm, "net": net, "note": "",
        })

    logs = db.query(models.TransactionLog).filter(
        models.TransactionLog.user_id == user_id,
    ).all()
    for log in logs:
        order = db.query(models.Order).filter(models.Order.id == log.order_id).first() if log.order_id else None
        product = order.product if order else None
        raw_amount = float(str(log.amount or 0))
        if log.action == "FUNDS_RELEASED":
            gross = float(str(order.total_price)) if order else abs(raw_amount)
            comm = gross * float(str(commission_rate))
            net = gross - comm
            txn_type = "sale"
            txn_status = "paid"
            buyer_label = order.buyer.name if order and order.buyer else ""
            items_label = product.name if product else ""
        elif "WITHDRAWAL" in log.action:
            gross = abs(raw_amount)
            comm = 0.0
            net = -gross
            txn_type = "payout"
            txn_status = "completed"
            buyer_label = "Retrait Lumicash"
            items_label = f"Vers {user.phone_number}"
        else:
            gross = abs(raw_amount)
            comm = 0.0
            net = raw_amount
            txn_type = "sale"
            txn_status = "pending"
            buyer_label = order.buyer.name if order and order.buyer else ""
            items_label = product.name if product else ""
        rows.append({
            "_sort_key": log.timestamp,
            "id": f"TXN-{log.id}",
            "type": txn_type, "status": txn_status,
            "channel": None, "destination_phone": None,
            "order_id": order.id if order else None,
            "order_reference": f"CMD-{order.id}" if order else None,
            "pickup_qr": order.pickup_qr_token if order else None,
            "buyer": buyer_label,
            "items": items_label,
            "date": log.timestamp.isoformat()[:10] if log.timestamp else "",
            "gross": gross, "commission": comm, "net": net, "note": "",
        })

    rows.sort(key=lambda r: r["_sort_key"] or datetime.min, reverse=True)
    for r in rows:
        del r["_sort_key"]
    return rows

# ─────────────────────── STATS ────────────────────────────────────────────────

def get_farmer_stats(farmer_id: int, *, db: Session) -> dict:
    user = db.query(models.User).filter(models.User.id == farmer_id).first()
    if not user:
        raise HTTPException(status_code=404)
    commission_rate = _get_commission_rate(db)
    total_sales = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.farmer_id == farmer_id,
        models.Order.status == ORDER_STATUS_COMPLETED,
    ).scalar() or Decimal("0.0")
    order_count = db.query(func.count(models.Order.id)).filter(
        models.Order.farmer_id == farmer_id,
    ).scalar() or 0
    pending_payout_raw = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.farmer_id == farmer_id,
        models.Order.status == ORDER_STATUS_PICKED_UP,
    ).scalar() or Decimal("0.0")
    pending_payout = Decimal(str(pending_payout_raw)) * (1 - commission_rate)

    now = utcnow_naive()
    weekly_sales = []
    for i in range(3, -1, -1):
        week_start = now - timedelta(days=now.weekday() + 7 * i)
        week_end = week_start + timedelta(days=7)
        amt = db.query(func.sum(models.Order.total_price)).filter(
            models.Order.farmer_id == farmer_id,
            models.Order.status == ORDER_STATUS_COMPLETED,
            models.Order.created_at >= week_start,
            models.Order.created_at < week_end,
        ).scalar() or Decimal("0.0")
        weekly_sales.append({"week": week_start.strftime("%Y-W%U"), "amount": float(str(amt))})

    return {
        "balance": float(str(user.balance or 0)),
        "total_sales_bif": float(str(total_sales)),
        "order_count": int(order_count),
        "pending_payout": float(str(pending_payout)),
        "weekly_sales": weekly_sales,
    }

def get_farmer_dashboard(farmer_id: int, *, db: Session) -> dict:
    user = db.query(models.User).filter(models.User.id == farmer_id).first()
    if not user:
        raise HTTPException(status_code=404)
    revenue = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.farmer_id == farmer_id,
        models.Order.status == ORDER_STATUS_COMPLETED,
    ).scalar() or 0))
    pending_count = db.query(func.count(models.Order.id)).filter(
        models.Order.farmer_id == farmer_id,
        models.Order.status != ORDER_STATUS_COMPLETED,
    ).scalar() or 0
    total_products = db.query(func.count(models.Product.id)).filter(
        models.Product.farmer_id == farmer_id
    ).scalar() or 0
    active_products = db.query(func.count(models.Product.id)).filter(
        models.Product.farmer_id == farmer_id,
        models.Product.quantity_kg > 0,
    ).scalar() or 0

    recent_orders = db.query(models.Order).filter(
        models.Order.farmer_id == farmer_id,
        models.Order.status != ORDER_STATUS_COMPLETED,
    ).order_by(models.Order.created_at.desc()).limit(5).all()

    now = utcnow_naive()
    weekly_sales = []
    for i in range(3, -1, -1):
        week_start = now - timedelta(days=now.weekday() + 7 * i)
        week_end = week_start + timedelta(days=7)
        amt = db.query(func.sum(models.Order.total_price)).filter(
            models.Order.farmer_id == farmer_id,
            models.Order.status == ORDER_STATUS_COMPLETED,
            models.Order.created_at >= week_start,
            models.Order.created_at < week_end,
        ).scalar() or Decimal("0.0")
        weekly_sales.append({"week": week_start.strftime("%Y-W%U"), "amount": float(str(amt))})

    return {
        "user": {"name": user.name, "province": user.province, "balance": float(str(user.balance or 0))},
        "stats": {"revenue": revenue, "pending_orders": pending_count,
                  "active_products": active_products, "total_products": total_products},
        "recent_orders": [
            {"id": o.id,
             "status": _STATUS_DASHBOARD.get(o.status, o.status.lower() if o.status else ""),
             "buyer": o.buyer.name if o.buyer else "",
             "amount": float(str(o.total_price)),
             "created_at": o.created_at.isoformat() if o.created_at else None}
            for o in recent_orders
        ],
        "weekly_sales": weekly_sales,
    }

# ─────────────────────── NOTIFICATIONS ───────────────────────────────────────

def _build_admin_notifications(db: Session, dismissed: set = None) -> List[dict]:
    if dismissed is None:
        dismissed = set()
    notifs = []
    now_str = utcnow_naive().isoformat()

    # Payout: WithdrawalRequests
    wrs = db.query(models.WithdrawalRequest).order_by(models.WithdrawalRequest.created_at.desc()).all()
    for wr in wrs:
        nid = f"notif-wr-{wr.id}"
        if nid in dismissed:
            continue
        ref = _format_withdrawal_reference(wr.id)
        if wr.status == "pending":
            title = "Retrait en attente"
        elif wr.status == "completed":
            title = "Retrait approuvé"
        else:
            title = "Retrait rejeté"
        farmer = wr.user
        body = (f"{farmer.name if farmer else '?'} — {float(str(wr.amount)):.0f} BIF via "
                f"{wr.channel} vers {wr.phone_number}")
        t = _notif_time(wr.created_at)
        notifs.append({"id": nid, "type": "payout", "title": title, "body": body,
                        "reference": ref, "read": False, "priority": "medium",
                        "created_at": t, "time": t})

    # Payout: FUNDS_RELEASED TransactionLogs (credit payouts to farmers)
    fund_logs = db.query(models.TransactionLog).filter(
        models.TransactionLog.action == "FUNDS_RELEASED"
    ).order_by(models.TransactionLog.timestamp.desc()).all()
    for log in fund_logs:
        nid = f"notif-funds-{log.id}"
        if nid in dismissed:
            continue
        farmer = db.query(models.User).filter(models.User.id == log.user_id).first()
        amount = float(str(log.amount or 0))
        body = f"{farmer.name if farmer else '?'} — {amount:.0f} BIF crédités"
        t = _notif_time(log.timestamp)
        notifs.append({"id": nid, "type": "payout", "title": "Paiement agriculteur effectué",
                        "body": body, "reference": f"TXN-{log.id}", "read": False,
                        "priority": "medium", "created_at": t, "time": t})

    # Testimonials (pending)
    testimonials = db.query(models.Testimonial).filter(
        models.Testimonial.status == "pending"
    ).order_by(models.Testimonial.created_at.desc()).all()
    for t_obj in testimonials:
        nid = f"notif-testimonial-{t_obj.id}"
        if nid in dismissed:
            continue
        t = _notif_time(t_obj.created_at)
        notifs.append({"id": nid, "type": "testimonial", "title": "Nouveau témoignage soumis",
                        "body": f"{t_obj.author_name} a soumis un témoignage.",
                        "reference": format_testimonial_reference(t_obj.id), "read": False,
                        "priority": "low", "created_at": t, "time": t})

    # Disputes
    disputes = db.query(models.Dispute).order_by(models.Dispute.created_at.desc()).all()
    for d in disputes:
        nid = f"notif-dispute-{d.id}"
        if nid in dismissed:
            continue
        last_audit = db.query(models.AdminAuditLog).filter(
            models.AdminAuditLog.entity_type == "dispute",
            models.AdminAuditLog.entity_id == d.id,
        ).order_by(models.AdminAuditLog.timestamp.desc()).first()
        last_action = last_audit.action if last_audit else "DISPUTE_OPENED"
        if last_action == "DISPUTE_REFUND_INITIATED":
            title = "Remboursement manuel lancé"
        elif d.status == "open":
            title = "Litige ouvert"
        elif d.status == "in-review":
            title = "Litige en cours d'examen"
        else:
            title = "Litige résolu"
        t = _notif_time(d.created_at)
        notifs.append({"id": nid, "type": "dispute", "title": title,
                        "body": f"#{d.id} — {d.reason}",
                        "reference": _format_dispute_reference(d.id), "read": False,
                        "priority": d.priority or "medium", "created_at": t, "time": t})

    # Stock: products below min_stock
    low_stock_products = db.query(models.Product).filter(
        models.Product.quantity_kg > 0,
        models.Product.quantity_kg <= models.Product.min_stock,
    ).all()
    for p in low_stock_products:
        nid = f"notif-stock-{p.id}"
        if nid in dismissed:
            continue
        farmer = p.farmer
        t = now_str
        notifs.append({"id": nid, "type": "stock", "title": "Stock faible",
                        "body": f"{p.name} ({farmer.name if farmer else '?'}) — {float(p.quantity_kg or 0):.0f} {p.unit} restant(s).",
                        "reference": f"PROD-{p.id}", "read": False,
                        "priority": "medium", "created_at": t, "time": t})

    # KYC aggregate
    kyc_count = db.query(func.count(models.User.id)).filter(
        models.User.kyc_status == "pending"
    ).scalar() or 0
    if kyc_count > 0:
        nid = "notif-kyc-pending"
        if nid not in dismissed:
            notifs.append({"id": nid, "type": "kyc", "title": "Dossiers KYC en attente",
                            "body": f"{kyc_count} dossier(s) KYC en attente de vérification.",
                            "reference": None, "read": False, "priority": "low",
                            "created_at": now_str, "time": now_str})

    # System
    nid = "notif-system-platform"
    if nid not in dismissed:
        notifs.append({"id": nid, "type": "system", "title": "Plateforme opérationnelle",
                        "body": "AgriConnect Burundi fonctionne normalement.",
                        "reference": None, "read": False, "priority": "low",
                        "created_at": now_str, "time": now_str})

    return notifs

def _build_user_notifications(user: models.User, db: Session, dismissed: set = None) -> List[dict]:
    if dismissed is None:
        dismissed = set()
    notifs = []
    now_str = utcnow_naive().isoformat()

    # Driver-specific notifications
    if user.role in config.DRIVER_ROLE_VALUES:
        # Available pickup orders (PAID_ESCROW, unassigned)
        available = db.query(models.Order).filter(
            models.Order.status == ORDER_STATUS_PAID_ESCROW
        ).all()
        for o in available:
            nid = f"notif-pickup-{o.id}"
            if nid in dismissed:
                continue
            product = o.product
            farmer = o.farmer
            t = _notif_time(o.created_at)
            notifs.append({"id": nid, "type": "pickup",
                            "title": f"Commande #{o.id} disponible",
                            "body": (f"{product.name if product else 'Commande'} "
                                     f"à collecter chez {farmer.name if farmer else 'le fermier'}."),
                            "reference": f"CMD-{o.id}", "read": False, "priority": "high",
                            "created_at": t, "time": t})

        # In-transit orders assigned to this driver
        in_transit = db.query(models.Order).filter(
            models.Order.status == ORDER_STATUS_PICKED_UP,
            models.Order.driver_id == user.id,
        ).all()
        for o in in_transit:
            nid = f"notif-delivery-{o.id}"
            if nid in dismissed:
                continue
            product = o.product
            buyer = o.buyer
            t = _notif_time(o.created_at)
            notifs.append({"id": nid, "type": "delivery",
                            "title": f"Livraison #{o.id} en cours",
                            "body": (f"Livrer {product.name if product else 'commande'} "
                                     f"à {buyer.name if buyer else 'acheteur'}."),
                            "reference": f"CMD-{o.id}", "read": False, "priority": "high",
                            "created_at": t, "time": t})

        # System notice
        nid = "notif-system-driver"
        if nid not in dismissed:
            notifs.append({"id": nid, "type": "system", "title": "Plateforme opérationnelle",
                            "body": "AgriConnect est opérationnel. Bonne livraison !",
                            "reference": None, "read": False, "priority": "low",
                            "created_at": now_str, "time": now_str})
        return notifs

    # Farmer notifications
    if user.role in config.FARMER_ROLE_VALUES:
        wrs = db.query(models.WithdrawalRequest).filter(
            models.WithdrawalRequest.user_id == user.id
        ).all()
        for wr in wrs:
            nid = f"notif-wr-{wr.id}"
            if nid in dismissed:
                continue
            ref = _format_withdrawal_reference(wr.id)
            if wr.status == "pending":
                title = "Retrait en attente"
                body = f"Votre retrait de {float(str(wr.amount)):.0f} BIF est en attente de traitement."
            elif wr.status == "completed":
                title = "Retrait traité"
                body = f"Votre retrait de {float(str(wr.amount)):.0f} BIF a été traité.{' ' + wr.note if wr.note else ''}"
            else:
                title = "Retrait rejeté"
                body = f"Votre retrait de {float(str(wr.amount)):.0f} BIF a été rejeté.{' ' + wr.note if wr.note else ''}"
            t = _notif_time(wr.created_at)
            notifs.append({"id": nid, "type": "payout", "title": title, "body": body,
                            "reference": ref, "read": False, "priority": "medium",
                            "created_at": t, "time": t})

    # Testimonial notifications
    if user.role in config.FARMER_ROLE_VALUES + config.BUYER_ROLE_VALUES:
        testimonials = db.query(models.Testimonial).filter(
            models.Testimonial.user_id == user.id
        ).all()
        for t_obj in testimonials:
            nid = f"notif-testimonial-{t_obj.id}"
            if nid in dismissed:
                continue
            ref = format_testimonial_reference(t_obj.id)
            if t_obj.status == "pending":
                title = "Témoignage reçu"
                body = "Votre témoignage a été reçu et sera relu par notre équipe avant publication."
            elif t_obj.status == "approved":
                title = "Témoignage approuvé"
                body = f"Votre témoignage a été approuvé et publié.{' ' + t_obj.admin_note if t_obj.admin_note else ''}"
            else:
                title = "Témoignage refusé"
                body = f"Votre témoignage n'a pas été retenu pour la publication.{' ' + t_obj.admin_note if t_obj.admin_note else ''}"
            t = _notif_time(t_obj.created_at)
            notifs.append({"id": nid, "type": "testimonial", "title": title, "body": body,
                            "reference": ref, "read": False, "priority": "low",
                            "created_at": t, "time": t})

    # Order notifications for buyer
    if user.role in config.BUYER_ROLE_VALUES:
        orders = db.query(models.Order).filter(
            models.Order.buyer_id == user.id,
        ).all()
        for o in orders:
            nid = f"notif-order-{o.id}"
            if nid in dismissed:
                continue
            status_label = _STATUS_DISPLAY.get(o.status, o.status.lower() if o.status else "")
            product = o.product
            product_name = product.name if product else "Commande"
            t = _notif_time(o.created_at)
            notifs.append({"id": nid, "type": "order",
                            "title": f"Commande #{o.id} — {product_name}",
                            "body": f"Votre commande est : {status_label}.",
                            "reference": f"CMD-{o.id}", "read": False, "priority": "low",
                            "created_at": t, "time": t})

    # Market alerts
    market_alerts = _generate_market_alerts(user, db)
    for a in market_alerts:
        if a["id"] not in dismissed:
            notifs.append(a)

    return notifs

def _generate_market_alerts(user: models.User, db: Session) -> List[dict]:
    if not user.province:
        return []
    history_cutoff = utcnow_naive() - timedelta(days=7)

    active_products = db.query(models.Product).filter(
        models.Product.province == user.province,
        models.Product.quantity_kg > 0,
    ).all()
    if not active_products:
        return []

    by_name: dict = defaultdict(list)
    for p in active_products:
        by_name[p.name].append(p)

    alerts = []
    now_str = utcnow_naive().isoformat()
    for product_name, products in by_name.items():
        max_current = max(float(str(p.price_per_kg)) for p in products)

        hist_prices = [
            float(str(r[0])) for r in
            db.query(models.OrderItem.price_at_order).join(
                models.Order, models.OrderItem.order_id == models.Order.id
            ).join(
                models.Product, models.OrderItem.product_id == models.Product.id
            ).filter(
                models.Product.name == product_name,
                models.Product.province == user.province,
                models.Order.status == ORDER_STATUS_COMPLETED,
                models.Order.created_at < history_cutoff,
            ).all()
        ]
        if not hist_prices:
            continue
        old_avg = sum(hist_prices) / len(hist_prices)
        if max_current <= old_avg * 1.1:
            continue
        province = user.province
        nid = f"notif-market-{product_name.lower().replace(' ', '-')[:20]}-{province.lower()}"
        if user.role in config.BUYER_ROLE_VALUES:
            title = f"Prix en hausse — {product_name}"
            body = (f"Les prix de {product_name} sont en hausse à {province}. "
                    f"Anticipez vos volumes pour sécuriser votre approvisionnement.")
        else:
            title = f"Marché porteur — {product_name}"
            body = (f"Les prix de {product_name} sont favorables à {province}. "
                    f"C'est le bon moment pour vendre votre production.")
        alerts.append({"id": nid, "type": "market", "title": title, "body": body,
                        "reference": f"MARKET-{province}-{product_name}",
                        "read": False, "priority": "medium",
                        "market_scope": "province", "market_scope_label": province,
                        "created_at": now_str, "time": now_str})
    return alerts

def _build_admin_stats_notifications(db: Session, dismissed: set = None) -> List[dict]:
    return _build_admin_notifications(db, dismissed)

def get_admin_stats(*, request=None, db: Session) -> dict:
    dismissed = set()
    if request:
        uid = _session_user_id(request)
        if uid:
            dismissed = _get_dismissed_ids(uid, db)

    settings = _get_system_settings(db)
    commission_rate = Decimal(str(settings.commission_rate)) if settings else config.DEFAULT_COMMISSION_RATE
    now = utcnow_naive()
    period_start = now - timedelta(days=30)
    prev_start = now - timedelta(days=60)

    gmv = float(str(db.query(func.sum(models.Order.total_price)).scalar() or 0))
    gmv_curr = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.created_at >= period_start).scalar() or 0))
    gmv_prev = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.created_at >= prev_start,
        models.Order.created_at < period_start).scalar() or 0))

    active_farmers = db.query(func.count(models.User.id)).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES), models.User.is_active == True
    ).scalar() or 0
    af_curr = db.query(func.count(func.distinct(models.Order.farmer_id))).filter(
        models.Order.created_at >= period_start).scalar() or 0
    af_prev = db.query(func.count(func.distinct(models.Order.farmer_id))).filter(
        models.Order.created_at >= prev_start,
        models.Order.created_at < period_start).scalar() or 0

    active_orders = db.query(func.count(models.Order.id)).filter(
        models.Order.status != ORDER_STATUS_COMPLETED).scalar() or 0
    ao_curr = db.query(func.count(models.Order.id)).filter(
        models.Order.status != ORDER_STATUS_COMPLETED,
        models.Order.created_at >= period_start).scalar() or 0
    ao_prev = db.query(func.count(models.Order.id)).filter(
        models.Order.status != ORDER_STATUS_COMPLETED,
        models.Order.created_at >= prev_start,
        models.Order.created_at < period_start).scalar() or 0

    completed_total = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status == ORDER_STATUS_COMPLETED).scalar() or 0))
    total_payouts = completed_total * float(str(1 - commission_rate))
    tp_curr = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status == ORDER_STATUS_COMPLETED,
        models.Order.created_at >= period_start).scalar() or 0)) * float(str(1 - commission_rate))
    tp_prev = float(str(db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status == ORDER_STATUS_COMPLETED,
        models.Order.created_at >= prev_start,
        models.Order.created_at < period_start).scalar() or 0)) * float(str(1 - commission_rate))

    payout_beneficiaries = db.query(func.count(func.distinct(models.Order.farmer_id))).filter(
        models.Order.status == ORDER_STATUS_COMPLETED).scalar() or 0
    payout_releases = db.query(func.count(models.Order.id)).filter(
        models.Order.status == ORDER_STATUS_COMPLETED).scalar() or 0

    def _wr_count(s): return db.query(func.count(models.WithdrawalRequest.id)).filter(
        models.WithdrawalRequest.status == s).scalar() or 0
    def _wr_sum(s): return float(str(db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == s).scalar() or 0))

    pending_wrs = _wr_count("pending")
    pending_wr_amt = _wr_sum("pending")
    completed_wrs = _wr_count("completed")
    completed_wr_amt = _wr_sum("completed")
    rejected_wrs = _wr_count("rejected")
    rejected_wr_amt = _wr_sum("rejected")
    total_wrs = db.query(func.count(models.WithdrawalRequest.id)).scalar() or 0
    avg_wr = float(str(db.query(func.avg(models.WithdrawalRequest.amount)).scalar() or 0))

    open_disp = db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "open").scalar() or 0
    in_review_disp = db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "in-review").scalar() or 0
    resolved_disp = db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "resolved").scalar() or 0
    high_prio = db.query(func.count(models.Dispute.id)).filter(models.Dispute.priority == "high").scalar() or 0

    province_rows = db.query(models.User.province, func.count(models.User.id).label("cnt")).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES)
    ).group_by(models.User.province).all()
    province_data = []
    for prov, fcnt in province_rows:
        if not prov:
            continue
        stock_tons = float(str(
            db.query(func.sum(models.Product.sold_quantity)).join(
                models.User, models.Product.farmer_id == models.User.id
            ).filter(models.User.province == prov).scalar() or 0
        ))
        orders_pending = db.query(func.count(models.Order.id)).join(
            models.User, models.Order.farmer_id == models.User.id
        ).filter(models.User.province == prov, models.Order.status != ORDER_STATUS_COMPLETED).scalar() or 0
        province_data.append({"province": prov, "farmers": fcnt,
                               "stock_tons": stock_tons, "orders_pending": orders_pending})

    top_rows = db.query(
        models.User.id, models.User.name, models.User.province,
        func.sum(models.Order.total_price).label("gmv"), models.User.rating,
    ).join(models.Order, models.User.id == models.Order.farmer_id).filter(
        models.Order.status == ORDER_STATUS_COMPLETED
    ).group_by(models.User.id).order_by(func.sum(models.Order.total_price).desc()).limit(5).all()
    top_farmers = [
        {"id": uid, "name": name, "province": prov or "", "gmv": float(str(gval or 0)),
         "rating": float(str(rat or 4.5))}
        for uid, name, prov, gval, rat in top_rows
    ]

    monthly_rows = db.query(
        func.strftime("%Y-%m", models.Order.created_at).label("month"),
        func.sum(models.Order.total_price).label("gmv"),
        func.count(models.Order.id).label("orders"),
    ).group_by("month").order_by("month").limit(6).all()
    monthly_gmv = [{"month": m, "gmv": float(str(g or 0)), "orders": int(str(o or 0))}
                   for m, g, o in monthly_rows]
    if not monthly_gmv:
        monthly_gmv = [{"month": now.strftime("%Y-%m"), "gmv": 0, "orders": 0}]

    recent_notifications = _build_admin_notifications(db, dismissed)
    unread_count = len(recent_notifications)

    kpi_growth = {
        "gmv": _safe_growth(gmv_curr, gmv_prev),
        "active_farmers": _safe_growth(af_curr, af_prev),
        "active_orders": _safe_growth(ao_curr, ao_prev),
        "total_payouts": _safe_growth(tp_curr, tp_prev),
    }

    return {
        "gmv": gmv, "active_farmers": active_farmers, "active_orders": active_orders,
        "total_payouts": total_payouts, "commission_rate": float(str(commission_rate)),
        "payout_beneficiaries": payout_beneficiaries, "payout_releases": payout_releases,
        "kpi_growth": kpi_growth, "province_data": province_data,
        "top_farmers": top_farmers, "monthly_gmv": monthly_gmv,
        "recent_notifications": recent_notifications, "unread_notifications": unread_count,
        "open_disputes": open_disp, "in_review_disputes": in_review_disp,
        "resolved_disputes": resolved_disp, "high_priority_disputes": high_prio,
        "pending_withdrawals": pending_wrs, "pending_withdrawal_amount": pending_wr_amt,
        "completed_withdrawals": completed_wrs, "completed_withdrawal_amount": completed_wr_amt,
        "rejected_withdrawals": rejected_wrs, "rejected_withdrawal_amount": rejected_wr_amt,
        "total_withdrawal_requests": total_wrs, "average_withdrawal_amount": avg_wr,
    }

# ─────────────────────── DISPUTES ────────────────────────────────────────────

def create_dispute(payload: schemas.DisputeCreate, *, db: Session) -> dict:
    order = db.query(models.Order).filter(models.Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404)
    pre_status = order.status
    order.status = ORDER_STATUS_DISPUTED
    dispute = models.Dispute(
        order_id=order.id, buyer_id=order.buyer_id, farmer_id=order.farmer_id,
        driver_id=order.driver_id, reason=payload.reason, detail=payload.detail,
        refund_requested=Decimal(str(payload.refund_requested)),
        amount=Decimal(str(order.total_price)), status="open",
        priority=payload.priority or "medium",
        pre_dispute_status=pre_status,
    )
    db.add(dispute)
    db.flush()
    db.add(models.AdminAuditLog(
        action="DISPUTE_OPENED", entity_type="dispute", entity_id=dispute.id,
        detail=f"Litige ouvert: {payload.reason}",
    ))
    db.commit()
    return {"dbId": dispute.id, "id": _format_dispute_reference(dispute.id),
            "status": "open", "priority": dispute.priority}

def review_dispute(dispute_id: int, *, payload: schemas.AdminActionRequest, db: Session) -> dict:
    d = db.query(models.Dispute).filter(models.Dispute.id == dispute_id).first()
    if not d:
        raise HTTPException(status_code=404)
    d.status = "in-review"
    db.add(models.AdminAuditLog(
        admin_user_id=payload.admin_user_id, action="DISPUTE_REVIEWED",
        entity_type="dispute", entity_id=d.id, detail="Dispute mis en revue.",
    ))
    db.commit()
    return {"status": "in-review"}

def reject_dispute(dispute_id: int, *, payload: schemas.AdminActionRequest = None, db: Session) -> dict:
    d = db.query(models.Dispute).filter(models.Dispute.id == dispute_id).first()
    if not d:
        raise HTTPException(status_code=404)
    d.status = "resolved"
    d.resolution = "Demande rejetée après vérification administrative manuelle."
    order = db.query(models.Order).filter(models.Order.id == d.order_id).first()
    if order and d.pre_dispute_status:
        order.status = d.pre_dispute_status
    admin_id = payload.admin_user_id if payload else None
    db.add(models.AdminAuditLog(
        admin_user_id=admin_id, action="DISPUTE_REJECTED",
        entity_type="dispute", entity_id=d.id, detail=d.resolution,
    ))
    db.commit()
    return {"status": "resolved", "resolution": d.resolution}

def refund_dispute(dispute_id: int, *, payload: schemas.AdminActionRequest, db: Session) -> dict:
    d = db.query(models.Dispute).filter(models.Dispute.id == dispute_id).first()
    if not d:
        raise HTTPException(status_code=404)
    amount = int(d.refund_requested) if d.refund_requested else 0
    resolution = f"Remboursement manuel interne simulé lancé pour {amount} BIF."
    d.status = "resolved"
    d.resolution = resolution
    order = db.query(models.Order).filter(models.Order.id == d.order_id).first()
    if order and d.pre_dispute_status:
        order.status = d.pre_dispute_status
    db.add(models.AdminAuditLog(
        admin_user_id=payload.admin_user_id, action="DISPUTE_REFUND_INITIATED",
        entity_type="dispute", entity_id=d.id, detail=resolution,
    ))
    db.commit()
    return {"status": "resolved", "resolution": resolution}

# ─────────────────────── WALLET ───────────────────────────────────────────────

def create_wallet_withdrawal(payload: schemas.WalletWithdrawalRequest, *, db: Session) -> dict:
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404)
    if user.role not in config.FARMER_ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Seuls les fermiers peuvent effectuer des retraits.")
    amount = Decimal(str(payload.amount))
    if amount < config.MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum {config.MIN_WITHDRAWAL_AMOUNT} BIF.")
    if Decimal(str(user.balance or 0)) < amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant.")

    channel = payload.channel or "Lumicash"
    phone = payload.phone_number or user.phone_number

    user.balance = Decimal(str(user.balance or 0)) - amount
    db.flush()

    # Has delivery history: completed orders OR completed withdrawal requests
    has_delivery = (
        db.query(models.Order.id).filter(
            models.Order.farmer_id == user.id,
            models.Order.status == ORDER_STATUS_COMPLETED,
        ).first() is not None
    ) or (
        db.query(models.WithdrawalRequest.id).filter(
            models.WithdrawalRequest.user_id == user.id,
            models.WithdrawalRequest.status == "completed",
        ).first() is not None
    )
    phone_matches = phone == user.phone_number
    under_threshold = amount <= config.AUTO_WITHDRAWAL_REVIEW_THRESHOLD

    if not has_delivery:
        status = "pending"
        note = "Votre demande sera traitée sous 24h après validation de votre compte."
        message = "Retrait soumis. Un historique confirmé est requis pour le traitement automatique."
    elif not phone_matches:
        status = "pending"
        note = (f"Le numéro principal du compte ({user.phone_number}) diffère du numéro de retrait fourni. "
                f"Votre demande sera traitée sous 24h.")
        message = "Votre demande de retrait sera traitée sous 24h."
    elif not under_threshold:
        status = "pending"
        note = "Retrait supérieur à 25 000 BIF — vérification manuelle requise. Votre demande sera traitée sous 24h."
        message = "Votre demande de retrait sera traitée sous 24h."
    else:
        status = "completed"
        note = "Traité automatiquement après contrôles de sécurité."
        message = "Votre retrait a été traité automatiquement."

    wr = models.WithdrawalRequest(
        user_id=user.id, amount=amount, channel=channel,
        phone_number=phone, status=status, note=note,
    )
    if status == "completed":
        wr.processed_at = utcnow_naive()
    db.add(wr)
    db.flush()

    db.add(models.AdminAuditLog(
        admin_user_id=user.id, action="WITHDRAWAL_REQUESTED",
        entity_type="withdrawal_request", entity_id=wr.id,
        detail=f"Retrait de {amount} BIF via {channel} par {user.name}",
    ))
    if status == "completed":
        db.add(models.AdminAuditLog(
            admin_user_id=None, action="WITHDRAWAL_APPROVED",
            entity_type="withdrawal_request", entity_id=wr.id,
            detail="Approuvé automatiquement.",
        ))
    db.commit()
    db.refresh(wr)
    db.refresh(user)

    return {
        "id": _format_withdrawal_reference(wr.id), "dbId": wr.id,
        "status": status, "channel": channel, "phone_number": phone,
        "balance": float(str(user.balance)), "message": message, "note": note,
    }

def approve_wallet_withdrawal(withdrawal_id: int, *, payload: schemas.AdminActionRequest, db: Session) -> dict:
    wr = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == withdrawal_id).first()
    if not wr:
        raise HTTPException(status_code=404)
    wr.status = "completed"
    wr.processed_by_user_id = payload.admin_user_id
    wr.processed_at = utcnow_naive()
    if payload.note:
        wr.note = payload.note
    db.add(models.AdminAuditLog(
        admin_user_id=payload.admin_user_id, action="WITHDRAWAL_APPROVED",
        entity_type="withdrawal_request", entity_id=wr.id,
        detail=payload.note or "Approuvé.",
    ))
    db.commit()
    db.refresh(wr)
    user = db.query(models.User).filter(models.User.id == wr.user_id).first()
    return {"status": "completed", "balance": float(str(user.balance if user else 0))}

def reject_wallet_withdrawal(withdrawal_id: int, *, payload: schemas.AdminActionRequest, db: Session) -> dict:
    wr = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == withdrawal_id).first()
    if not wr:
        raise HTTPException(status_code=404)
    user = db.query(models.User).filter(models.User.id == wr.user_id).first()
    if user:
        user.balance = Decimal(str(user.balance or 0)) + Decimal(str(wr.amount))
    wr.status = "rejected"
    wr.processed_by_user_id = payload.admin_user_id
    wr.processed_at = utcnow_naive()
    if payload.note:
        wr.note = payload.note
    db.add(models.AdminAuditLog(
        admin_user_id=payload.admin_user_id, action="WITHDRAWAL_REJECTED",
        entity_type="withdrawal_request", entity_id=wr.id,
        detail=payload.note or "Rejeté.",
    ))
    db.commit()
    db.refresh(user)
    return {"status": "rejected", "balance": float(str(user.balance if user else 0))}

def list_admin_withdrawals(*, status: Optional[str] = None, db: Session) -> List[dict]:
    q = db.query(models.WithdrawalRequest)
    if status:
        q = q.filter(models.WithdrawalRequest.status == status)
    wrs = q.order_by(models.WithdrawalRequest.id.desc()).all()
    result = []
    for wr in wrs:
        farmer = wr.user
        processed_by = wr.processed_by
        audit_logs = db.query(models.AdminAuditLog).filter(
            models.AdminAuditLog.entity_type == "withdrawal_request",
            models.AdminAuditLog.entity_id == wr.id,
        ).order_by(models.AdminAuditLog.timestamp.asc()).all()
        trail = []
        for log in audit_logs:
            if log.action == "WITHDRAWAL_REQUESTED":
                actor = farmer.name if farmer else None
            else:
                actor = log.admin_user.name if log.admin_user else None
            trail.append({
                "id": str(log.id), "action": log.action,
                "title": log.action.replace("_", " ").title(),
                "detail": log.detail or "",
                "actorName": actor,
                "createdAt": log.timestamp.isoformat() if log.timestamp else "",
                "tone": "positive" if "APPROVED" in log.action else ("negative" if "REJECTED" in log.action else "neutral"),
            })
        result.append({
            "id": _format_withdrawal_reference(wr.id), "dbId": wr.id,
            "farmerId": farmer.id if farmer else None,
            "farmerName": farmer.name if farmer else "",
            "farmerPhoneNumber": farmer.phone_number if farmer else None,
            "province": farmer.province if farmer else None,
            "amount": float(str(wr.amount)), "channel": wr.channel,
            "phoneNumber": wr.phone_number, "status": wr.status, "note": wr.note,
            "createdAt": wr.created_at.isoformat() if wr.created_at else "",
            "processedAt": wr.processed_at.isoformat() if wr.processed_at else None,
            "processedByUserId": wr.processed_by_user_id,
            "processedByName": processed_by.name if processed_by else None,
            "auditTrail": trail,
        })
    return result

# ─────────────────────── PLATFORM / SETTINGS ──────────────────────────────────

def get_admin_settings(*, db: Session) -> dict:
    s = _get_system_settings(db)
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    return {
        "commission_rate": float(str(s.commission_rate)),
        "maintenance_mode": bool(s.maintenance_mode),
        "support_phone": s.support_phone or DEFAULT_SUPPORT_PHONE,
        "support_whatsapp": s.support_whatsapp or DEFAULT_SUPPORT_WHATSAPP,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        "admins": [{"id": a.id, "name": a.name, "phone_number": a.phone_number,
                    "province": a.province} for a in admins],
    }

def update_admin_settings(payload: schemas.PlatformSettingsUpdate, *, db: Session) -> dict:
    if payload.commission_rate is not None:
        if payload.commission_rate < 0 or payload.commission_rate > 0.5:
            raise HTTPException(status_code=400, detail="Taux de commission invalide (0–50%).")
    if payload.support_phone is not None and not payload.support_phone.strip():
        raise HTTPException(status_code=400, detail="Numéro de support invalide.")
    s = _get_system_settings(db)
    if payload.commission_rate is not None:
        s.commission_rate = Decimal(str(payload.commission_rate))
    if payload.maintenance_mode is not None:
        s.maintenance_mode = payload.maintenance_mode
    if payload.support_phone is not None:
        s.support_phone = payload.support_phone.strip()
    if payload.support_whatsapp is not None:
        s.support_whatsapp = payload.support_whatsapp.strip()
    s.updated_at = utcnow_naive()
    db.commit()
    db.refresh(s)
    return get_admin_settings(db=db)

# ─────────────────────── SUPPORT TICKETS ──────────────────────────────────────

def create_support_ticket(payload: schemas.SupportTicketCreate, *, db: Session) -> models.SupportTicket:
    subject = (payload.subject or "").strip()
    message = (payload.message or "").strip()
    channel = (payload.channel or "app").strip().lower()
    if not subject:
        raise HTTPException(status_code=400, detail="Sujet vide.")
    user_id = payload.user_id
    user = db.query(models.User).filter(models.User.id == user_id).first() if user_id else None
    role = user.role if user else "acheteur"
    ticket = models.SupportTicket(
        user_id=user_id, role=role, channel=channel,
        subject=subject, message=message, status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

def list_support_tickets(user_id: int, *, db: Session) -> List[models.SupportTicket]:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)
    return db.query(models.SupportTicket).filter(
        models.SupportTicket.user_id == user_id
    ).order_by(models.SupportTicket.created_at.desc()).all()

# ─────────────────────── TESTIMONIALS ────────────────────────────────────────

_SEED_TESTIMONIALS = [
    {
        "quote_fr": "Grâce à AgriConnect, j'écoule mes tomates en 48h au lieu de les voir pourrir.",
        "quote_ki": "Bafasha kugurisha imbirika mu masaha 48 aho kuzibora.",
        "author_name": "Pascal N.", "author_role_fr": "Fermier", "author_role_ki": "Umurimyi",
        "location": "Ngozi", "rating": 5.0, "sort_order": 1,
    },
    {
        "quote_fr": "Je reçois des légumes frais chaque matin, directement du producteur.",
        "quote_ki": "Mbona imboga nshasha mu gitondo, zivuye vy'ukuri mu murima.",
        "author_name": "Sarah M.", "author_role_fr": "Acheteuse", "author_role_ki": "Umuguzi",
        "location": "Bujumbura", "rating": 5.0, "sort_order": 2,
    },
]

def _seed_testimonials(db: Session):
    for data in _SEED_TESTIMONIALS:
        exists = db.query(models.Testimonial).filter(
            models.Testimonial.author_name == data["author_name"]
        ).first()
        if not exists:
            db.add(models.Testimonial(
                quote_fr=data["quote_fr"], quote_ki=data["quote_ki"],
                author_name=data["author_name"], author_role_fr=data["author_role_fr"],
                author_role_ki=data["author_role_ki"], location=data["location"],
                rating=Decimal(str(data["rating"])), status="approved",
                is_active=True, sort_order=data["sort_order"],
            ))
    db.commit()

def get_public_testimonials(*, db: Session) -> List[dict]:
    count = db.query(func.count(models.Testimonial.id)).scalar() or 0
    if count == 0:
        _seed_testimonials(db)
    rows = db.query(models.Testimonial).filter(
        models.Testimonial.is_active == True,
        models.Testimonial.status == "approved",
    ).order_by(models.Testimonial.sort_order.asc(), models.Testimonial.id.asc()).all()
    return [{"id": t.id, "quote_fr": t.quote_fr, "quote_ki": t.quote_ki,
             "author_name": t.author_name, "author_role_fr": t.author_role_fr,
             "author_role_ki": t.author_role_ki, "location": t.location,
             "rating": float(str(t.rating))} for t in rows]

def _get_auth_user_from_session(request, db: Session) -> models.User:
    session = _require_auth(request)
    return db.query(models.User).filter(models.User.id == session["user_id"]).first()

def create_testimonial_submission(
    payload: schemas.TestimonialSubmissionCreate, *, request, db: Session
) -> dict:
    user = _get_auth_user_from_session(request, db)
    if not user:
        raise HTTPException(status_code=401)
    role_fr_map = {"fermier": "Fermier", "farmer": "Fermier",
                   "acheteur": "Acheteuse", "buyer": "Acheteuse",
                   "logistique": "Livreur", "driver": "Livreur", "admin": "Admin"}
    role_ki_map = {"fermier": "Umurimyi", "farmer": "Umurimyi",
                   "acheteur": "Umuguzi", "buyer": "Umuguzi",
                   "logistique": "Umutwara", "driver": "Umutwara", "admin": "Admin"}
    t = models.Testimonial(
        user_id=user.id, quote_fr=payload.message, quote_ki=payload.message,
        author_name=user.name,
        author_role_fr=role_fr_map.get(user.role, user.role),
        author_role_ki=role_ki_map.get(user.role, user.role),
        location=user.province, rating=Decimal(str(payload.rating)),
        status="pending", is_active=False, sort_order=0,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "status": t.status, "author_name": t.author_name,
            "quote_fr": t.quote_fr, "rating": float(str(t.rating)),
            "created_at": t.created_at.isoformat() if t.created_at else ""}

def get_my_testimonials(request, *, db: Session) -> List[dict]:
    user = _get_auth_user_from_session(request, db)
    if not user:
        raise HTTPException(status_code=401)
    rows = db.query(models.Testimonial).filter(
        models.Testimonial.user_id == user.id
    ).order_by(models.Testimonial.created_at.desc()).all()
    return [{"id": t.id, "status": t.status, "quote_fr": t.quote_fr,
             "rating": float(str(t.rating)), "admin_note": t.admin_note,
             "created_at": t.created_at.isoformat() if t.created_at else ""} for t in rows]

def approve_testimonial_submission(
    testimonial_id: int, *, payload: schemas.AdminActionRequest, db: Session
) -> dict:
    t = db.query(models.Testimonial).filter(models.Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404)
    t.status = "approved"
    t.is_active = True
    t.reviewed_at = utcnow_naive()
    t.reviewed_by_user_id = payload.admin_user_id
    if payload.note:
        t.admin_note = payload.note
    db.commit()
    return {"status": "approved", "id": t.id}

def reject_testimonial_submission(
    testimonial_id: int, *, payload: schemas.AdminActionRequest, db: Session
) -> dict:
    t = db.query(models.Testimonial).filter(models.Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404)
    t.status = "rejected"
    t.is_active = False
    t.reviewed_at = utcnow_naive()
    t.reviewed_by_user_id = payload.admin_user_id
    if payload.note:
        t.admin_note = payload.note
    db.commit()
    return {"status": "rejected", "id": t.id}

def list_admin_testimonials(*, status: Optional[str] = None, db: Session) -> List[dict]:
    q = db.query(models.Testimonial)
    if status:
        q = q.filter(models.Testimonial.status == status)
    rows = q.order_by(models.Testimonial.created_at.desc()).all()
    result = []
    for t in rows:
        reviewed_by = t.reviewed_by
        result.append({
            "id": format_testimonial_reference(t.id), "dbId": t.id,
            "userId": t.user_id, "authorName": t.author_name,
            "authorRoleFr": t.author_role_fr, "authorRoleKi": t.author_role_ki,
            "location": t.location, "quoteFr": t.quote_fr, "quoteKi": t.quote_ki,
            "rating": float(str(t.rating)), "status": t.status, "adminNote": t.admin_note,
            "createdAt": t.created_at.isoformat() if t.created_at else "",
            "reviewedAt": t.reviewed_at.isoformat() if t.reviewed_at else None,
            "reviewedByUserId": t.reviewed_by_user_id,
            "reviewedByName": reviewed_by.name if reviewed_by else None,
            "auditTrail": [],
        })
    return result

# ─────────────────────── FINANCE AUDITS ──────────────────────────────────────

def list_admin_finance_audits(
    *, entity_type: Optional[str] = None, action: Optional[str] = None,
    q: Optional[str] = None, limit: int = 100, db: Session
) -> dict:
    qr = db.query(models.AdminAuditLog).filter(
        models.AdminAuditLog.entity_type.in_(["withdrawal_request", "dispute"])
    )
    if entity_type:
        qr = qr.filter(models.AdminAuditLog.entity_type == entity_type)
    if action:
        qr = qr.filter(models.AdminAuditLog.action == action)

    all_logs = qr.order_by(models.AdminAuditLog.timestamp.desc()).all()

    withdrawal_events = sum(1 for l in all_logs if l.entity_type == "withdrawal_request")
    dispute_events = sum(1 for l in all_logs if l.entity_type == "dispute")
    high_prio_events = sum(
        1 for l in all_logs
        if l.entity_type == "dispute" and
        (db.query(models.Dispute.priority).filter(models.Dispute.id == l.entity_id).scalar() or "") == "high"
    )
    pending_wr_events = sum(
        1 for l in all_logs
        if l.action == "WITHDRAWAL_REQUESTED" and
        (db.query(models.WithdrawalRequest.status).filter(
            models.WithdrawalRequest.id == l.entity_id
        ).scalar() or "") == "pending"
    )

    if q:
        try:
            if q.startswith("WDR-"):
                eid = int(q.split("-")[1])
                all_logs = [l for l in all_logs if l.entity_id == eid and l.entity_type == "withdrawal_request"]
            elif q.startswith("DIS-"):
                eid = int(q.split("-")[1])
                all_logs = [l for l in all_logs if l.entity_id == eid and l.entity_type == "dispute"]
        except Exception:
            pass

    items_raw = all_logs[:limit]
    items = []
    for log in items_raw:
        actor = None
        if log.action == "WITHDRAWAL_REQUESTED":
            wr = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == log.entity_id).first()
            if wr and wr.user:
                actor = wr.user.name
        elif log.admin_user:
            actor = log.admin_user.name

        ref = None
        priority = "low"
        status_val = None
        if log.entity_type == "withdrawal_request":
            ref = f"WDR-{log.entity_id}"
            wr = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == log.entity_id).first()
            status_val = wr.status if wr else None
        elif log.entity_type == "dispute":
            ref = f"DIS-{log.entity_id}"
            d = db.query(models.Dispute).filter(models.Dispute.id == log.entity_id).first()
            priority = d.priority if d else "low"
            status_val = d.status if d else None

        items.append({
            "id": str(log.id), "action": log.action,
            "title": log.action.replace("_", " ").title(),
            "detail": log.detail or "",
            "actorName": actor,
            "createdAt": log.timestamp.isoformat() if log.timestamp else "",
            "tone": "positive" if "APPROVED" in log.action else ("negative" if "REJECTED" in log.action else "neutral"),
            "entityType": log.entity_type, "entityId": log.entity_id,
            "entityLabel": ref, "reference": ref,
            "priority": priority, "status": status_val,
        })

    return {
        "items": items,
        "summary": {
            "total": len(all_logs),
            "withdrawalEvents": withdrawal_events,
            "disputeEvents": dispute_events,
            "highPriorityEvents": high_prio_events,
            "pendingWithdrawalEvents": pending_wr_events,
        },
    }

# ─────────────────────── NOTIFICATIONS ENDPOINTS ─────────────────────────────

def get_notifications(user_id: int, *, request, db: Session) -> List[dict]:
    session = _require_auth(request)
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)
    dismissed = _get_dismissed_ids(user_id, db)
    if user.role == "admin":
        return _build_admin_notifications(db, dismissed)
    return _build_user_notifications(user, db, dismissed)

def dismiss_notification(
    payload: schemas.NotificationDismissRequest, request, *, db: Session
) -> Response:
    session = _require_auth(request)
    user_id = session["user_id"]
    exists = db.query(models.NotificationDismissal).filter(
        models.NotificationDismissal.user_id == user_id,
        models.NotificationDismissal.notification_id == payload.notification_id,
    ).first()
    if not exists:
        db.add(models.NotificationDismissal(
            user_id=user_id, notification_id=payload.notification_id
        ))
        db.commit()
    resp = Response()
    resp.status_code = 204
    return resp

# ─────────────────────── AUTH / SESSION ──────────────────────────────────────

def set_authenticated_session(response, user: models.User):
    token = str(uuid.uuid4())
    auth_sessions[token] = {"user_id": user.id, "role": user.role}
    response.set_cookie(
        key=SESSION_COOKIE_NAME, value=token,
        httponly=True, samesite="lax", max_age=config.SESSION_MAX_AGE,
    )
    return token

def request_otp(phone_number: str, *, db: Session) -> dict:
    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user and not user.is_active:
        raise HTTPException(status_code=403, detail="Ce numéro a été suspendu. Contactez l'administrateur.")
    otp = "".join(random.choices(string.digits, k=6))
    pending_otps[phone_number] = otp
    return {"message": "OTP envoyé.", "mock_otp": otp}

def verify_otp(phone_number: str, otp: str, request, response, *, db: Session) -> dict:
    stored = pending_otps.get(phone_number)
    if not stored or stored != otp:
        raise HTTPException(status_code=400, detail="OTP invalide.")
    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user and not user.is_active:
        del pending_otps[phone_number]
        raise HTTPException(status_code=403, detail="Ce numéro a été suspendu. Contactez l'administrateur.")
    del pending_otps[phone_number]
    if not user:
        return {"registered": False, "message": "Numéro non enregistré. Veuillez compléter votre profil."}
    set_authenticated_session(response, user)
    return {"registered": True, "user_id": user.id, "role": user.role}

def auth_me(request, *, db: Session) -> schemas.AuthSession:
    session = _require_auth(request)
    return schemas.AuthSession(user_id=session["user_id"], role=session["role"])

def logout(request, response) -> None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token and token in auth_sessions:
        del auth_sessions[token]
    response.delete_cookie(SESSION_COOKIE_NAME)
    response.status_code = 204

def register_user(payload: schemas.UserCreate, *, response, db: Session) -> schemas.AuthSession:
    user = create_user(payload, db=db)
    set_authenticated_session(response, user)
    return schemas.AuthSession(user_id=user.id, role=user.role)

# ─────────────────────── MOCK MOBILE MONEY ───────────────────────────────────

_PROVIDER_MAP = {
    "Lumicash": "Lumicash", "Lumitel": "Lumicash",
    "Ecocash": "Ecocash", "EconetLeo": "Ecocash",
}

def _calc_fees(provider: str, amount: Decimal, fee_bearer: str) -> dict:
    norm = _PROVIDER_MAP.get(provider, "Lumicash")
    rate = Decimal(str(config.MOCK_MOBILE_MONEY_FEE_RATES.get(norm, 0.01)))
    min_fee = Decimal(str(config.MOCK_MOBILE_MONEY_MIN_FEES.get(norm, 150)))
    fee = max(min_fee, amount * rate)
    tax = (fee * Decimal(str(config.MOCK_MOBILE_MONEY_TAX_RATE))).quantize(Decimal("0.01"))
    fee = fee.quantize(Decimal("0.01"))
    if fee_bearer == "recipient":
        net = amount - fee - tax
        total = amount
    else:
        net = amount
        total = amount + fee + tax
    return {"provider": norm, "fee": fee, "tax": tax, "net": net, "total": total}

def create_mock_mobile_money_payout(
    payload: schemas.MockMobileMoneyPayoutRequest, *, db: Session
) -> dict:
    wr = None
    if payload.withdrawal_id:
        wr = db.query(models.WithdrawalRequest).filter(
            models.WithdrawalRequest.id == payload.withdrawal_id
        ).first()
        if not wr:
            raise HTTPException(status_code=404)
        provider = _PROVIDER_MAP.get(payload.provider, wr.channel or "Lumicash")
        phone = wr.phone_number
        amount = Decimal(str(wr.amount))
    else:
        provider = _PROVIDER_MAP.get(payload.provider or "Lumicash", "Lumicash")
        phone = payload.phone_number or ""
        amount = Decimal(str(payload.amount or 0))

    fee_bearer = payload.fee_bearer or "recipient"
    fees = _calc_fees(provider, amount, fee_bearer)
    ref = "MMP-" + uuid.uuid4().hex[:12].upper()
    txn_id = "TXN-" + uuid.uuid4().hex[:8].upper()
    now = utcnow_naive().isoformat()
    payout = {
        "reference": ref, "provider": fees["provider"],
        "phone_number": phone, "amount": float(str(amount)),
        "currency": "BIF", "fee_bearer": fee_bearer,
        "provider_fee": float(str(fees["fee"])),
        "tax_amount": float(str(fees["tax"])),
        "net_amount": float(str(fees["net"])),
        "total_debited": float(str(fees["total"])),
        "status": "accepted", "provider_transaction_id": txn_id,
        "linked_withdrawal_id": wr.id if wr else None,
        "linked_withdrawal_reference": _format_withdrawal_reference(wr.id) if wr else None,
        "note": None, "created_at": now, "updated_at": now,
    }
    mock_mobile_money_payouts[ref] = payout
    return payout

def get_mock_mobile_money_payout(reference: str) -> dict:
    p = mock_mobile_money_payouts.get(reference)
    if not p:
        raise HTTPException(status_code=404)
    return p

def complete_mock_mobile_money_payout(
    reference: str, *, payload: schemas.MockMobileMoneyStatusUpdateRequest = None, db: Session
) -> dict:
    p = mock_mobile_money_payouts.get(reference)
    if not p:
        raise HTTPException(status_code=404)
    if p["status"] == "completed":
        raise HTTPException(status_code=400, detail="Déjà complété.")
    note_text = (payload.note if payload and payload.note else "") or ""
    p["status"] = "completed"
    p["note"] = note_text
    p["updated_at"] = utcnow_naive().isoformat()
    if p.get("linked_withdrawal_id"):
        wr = db.query(models.WithdrawalRequest).filter(
            models.WithdrawalRequest.id == p["linked_withdrawal_id"]
        ).first()
        if wr:
            wr.status = "completed"
            wr.processed_at = utcnow_naive()
            wr.note = f"Traité via {reference}. {note_text}".strip()
            db.add(models.AdminAuditLog(
                admin_user_id=None, action="WITHDRAWAL_APPROVED",
                entity_type="withdrawal_request", entity_id=wr.id,
                detail=f"Approuvé via payout mock {reference}.",
            ))
            db.commit()
    return p

def fail_mock_mobile_money_payout(
    reference: str, *, payload: schemas.MockMobileMoneyStatusUpdateRequest = None, db: Session = None
) -> dict:
    p = mock_mobile_money_payouts.get(reference)
    if not p:
        raise HTTPException(status_code=404)
    if p["status"] in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Statut non modifiable.")
    note_text = (payload.note if payload and payload.note else "") or ""
    p["status"] = "failed"
    p["note"] = note_text
    p["updated_at"] = utcnow_naive().isoformat()
    if p.get("linked_withdrawal_id") and db:
        wr = db.query(models.WithdrawalRequest).filter(
            models.WithdrawalRequest.id == p["linked_withdrawal_id"]
        ).first()
        if wr:
            user = db.query(models.User).filter(models.User.id == wr.user_id).first()
            if user:
                user.balance = Decimal(str(user.balance or 0)) + Decimal(str(wr.amount))
            wr.status = "rejected"
            wr.processed_at = utcnow_naive()
            wr.note = f"Échec via {reference}. {note_text}".strip()
            db.add(models.AdminAuditLog(
                admin_user_id=None, action="WITHDRAWAL_REJECTED",
                entity_type="withdrawal_request", entity_id=wr.id,
                detail=f"Rejeté via payout mock {reference}.",
            ))
            db.commit()
    return p


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=os.getenv("BACKEND_HOST", "127.0.0.1"),
        port=int(os.getenv("BACKEND_PORT", "8000")),
    )
