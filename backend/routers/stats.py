from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from decimal import Decimal
import backend.models as models, backend.schemas as schemas, backend.utils as utils, backend.config as config
from typing import List, Optional, Any, cast
from backend.database import get_db
from backend.services.market_service import market_service

router = APIRouter(
    prefix="/stats",
    tags=["Statistics & Market Data"]
)

@router.get("/prices")
@router.get("/prices/")
def get_market_prices(province: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Retourne les prix du marché (Soko Live) tels qu'attendus par le frontend.
    """
    return market_service.get_live_prices(db, province)

@router.get("/public")
def get_public_stats(db: Session = Depends(get_db)):
    """
    Retourne les statistiques publiques pour la landing page.
    """
    from sqlalchemy import func
    farmer_count = db.query(func.count(models.User.id)).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES),
        models.User.is_active == True
    ).scalar() or 0
    
    province_count = db.query(func.count(func.distinct(models.User.province))).filter(
        models.User.province.isnot(None),
        models.User.role.in_(config.FARMER_ROLE_VALUES)
    ).scalar() or 0
    
    return {
        "farmer_count": farmer_count,
        "province_count": province_count,
        "standard_commission_rate": config.DEFAULT_COMMISSION_RATE,
        "promo_commission_rate": config.PROMO_COMMISSION_RATE,
        "promo_sales_threshold": config.PROMO_SALES_THRESHOLD,
    }

@router.get("/agriculture")
def get_agriculture_stats(request: Request, db: Session = Depends(get_db)):
    """
    Statistiques agrégées pour la supervision réglementaire (ex. Ministère de
    l'Agriculture) : production et répartition par province/catégorie, prix
    du marché. Volontairement dépourvu de toute donnée financière (GMV,
    commissions, versements) ou nominative individuelle — réservé aux
    agrégats de politique agricole.
    """
    from sqlalchemy import func

    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "admin", "ministere_agriculture"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administration et au Ministère de l'Agriculture.")

    farmer_count = db.query(func.count(models.User.id)).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES),
        models.User.is_active == True
    ).scalar() or 0

    provinces = [
        p[0] for p in db.query(func.distinct(models.User.province)).filter(
            models.User.province.isnot(None),
            models.User.role.in_(config.FARMER_ROLE_VALUES)
        ).all()
    ]

    active_products = db.query(models.Product).filter(
        models.Product.quantity_kg > 0,
        models.Product.is_active == True
    ).all()

    production_by_province: dict[str, float] = {}
    production_by_category: dict[str, float] = {}
    for p in active_products:
        qty = float(p.quantity_kg or 0)
        if p.province:
            production_by_province[p.province] = production_by_province.get(p.province, 0.0) + qty
        if p.category:
            production_by_category[p.category] = production_by_category.get(p.category, 0.0) + qty

    return {
        "farmer_count": farmer_count,
        "province_count": len(provinces),
        "provinces": sorted(provinces),
        "active_listings": len(active_products),
        "production_by_province_kg": [
            {"province": prov, "quantity_kg": qty} for prov, qty in sorted(production_by_province.items())
        ],
        "production_by_category_kg": [
            {"category": cat, "quantity_kg": qty} for cat, qty in sorted(production_by_category.items())
        ],
        "market_prices": market_service.get_live_prices(db),
    }

import fastapi

@router.get("/admin", response_model=schemas.AdminStats)
def get_admin_stats(request: fastapi.Request, db: Session = Depends(get_db)):
    """
    KPIs admin AgriConnect : GMV, commissions, growth 30j, conversion/annulation.
    """
    from backend.routers.admin import check_admin_auth
    check_admin_auth(request, db)
    from sqlalchemy import func

    now = utils.utcnow_naive()
    period_start = now - timedelta(days=30)
    prev_period_start = now - timedelta(days=60)

    COMPLETED_STATUSES = ["PAID_ESCROW", "COMPLETED", "DELIVERED", "PAID"]
    ACTIVE_STATUSES = [
        "PENDING", "PENDING_PAYMENT", "PAID_ESCROW", "CONFIRMED",
        "READY_FOR_PICKUP", "PICKED_UP", "DISPUTED",
    ]

    # ── Commission rate ───────────────────────────────────────────────────────
    settings = db.query(models.SystemSettings).first()
    commission_rate = Decimal(str(settings.commission_rate)) if settings else config.DEFAULT_COMMISSION_RATE

    # ── GMV ───────────────────────────────────────────────────────────────────
    gmv = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status.in_(COMPLETED_STATUSES)
    ).scalar() or Decimal("0.0")

    gmv_current = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status.in_(COMPLETED_STATUSES),
        models.Order.created_at >= period_start,
    ).scalar() or Decimal("0.0")

    gmv_prev = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status.in_(COMPLETED_STATUSES),
        models.Order.created_at >= prev_period_start,
        models.Order.created_at < period_start,
    ).scalar() or Decimal("1.0")

    # ── Métriques de commission estimées ──────────────────────────────────────
    total_commission_estimated = Decimal(str(gmv)) * commission_rate
    commission_current_period = Decimal(str(gmv_current)) * commission_rate

    # ── Fermiers actifs ───────────────────────────────────────────────────────
    active_farmers = db.query(func.count(models.User.id)).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES),
        models.User.is_active == True,
    ).scalar() or 0

    active_farmers_current = db.query(
        func.count(func.distinct(models.Order.farmer_id))
    ).filter(models.Order.created_at >= period_start).scalar() or 0

    active_farmers_prev = db.query(
        func.count(func.distinct(models.Order.farmer_id))
    ).filter(
        models.Order.created_at >= prev_period_start,
        models.Order.created_at < period_start,
    ).scalar() or 0

    # ── Commandes actives ─────────────────────────────────────────────────────
    active_orders = db.query(func.count(models.Order.id)).filter(
        models.Order.status.in_(ACTIVE_STATUSES)
    ).scalar() or 0

    active_orders_current = db.query(func.count(models.Order.id)).filter(
        models.Order.status.in_(ACTIVE_STATUSES),
        models.Order.created_at >= period_start,
    ).scalar() or 0

    active_orders_prev = db.query(func.count(models.Order.id)).filter(
        models.Order.status.in_(ACTIVE_STATUSES),
        models.Order.created_at >= prev_period_start,
        models.Order.created_at < period_start,
    ).scalar() or 0

    # ── Retraits ──────────────────────────────────────────────────────────────
    total_payouts = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "completed"
    ).scalar() or Decimal("0.0")

    total_payouts_current = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "completed",
        models.WithdrawalRequest.created_at >= period_start,
    ).scalar() or Decimal("0.0")

    total_payouts_prev = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "completed",
        models.WithdrawalRequest.created_at >= prev_period_start,
        models.WithdrawalRequest.created_at < period_start,
    ).scalar() or Decimal("1.0")

    pending_withdrawals = db.query(func.count(models.WithdrawalRequest.id)).filter(
        models.WithdrawalRequest.status == "pending"
    ).scalar() or 0
    pending_amount = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "pending"
    ).scalar() or Decimal("0.0")

    # ── KPI Growth (% variation 30j vs 30j précédents) ────────────────────────
    def safe_growth(current: Any, prev: Any) -> float:
        c = float(str(current or 0))
        p = float(str(prev or 0))
        if p == 0:
            return 100.0 if c > 0 else 0.0
        return round(((c - p) / p) * 100, 1)

    kpi_growth = {
        "gmv": safe_growth(gmv_current, gmv_prev),
        "active_farmers": safe_growth(active_farmers_current, active_farmers_prev),
        "active_orders": safe_growth(active_orders_current, active_orders_prev),
        "total_payouts": safe_growth(total_payouts_current, total_payouts_prev),
    }

    # ── Taux de conversion et d'annulation ────────────────────────────────────
    total_orders_current = db.query(func.count(models.Order.id)).filter(
        models.Order.created_at >= period_start,
    ).scalar() or 1

    completed_current = db.query(func.count(models.Order.id)).filter(
        models.Order.status.in_(COMPLETED_STATUSES),
        models.Order.created_at >= period_start,
    ).scalar() or 0

    cancelled_total = db.query(func.count(models.Order.id)).filter(
        models.Order.status == "CANCELLED"
    ).scalar() or 0

    cancelled_current = db.query(func.count(models.Order.id)).filter(
        models.Order.status == "CANCELLED",
        models.Order.created_at >= period_start,
    ).scalar() or 0

    conversion_rate = round((int(str(completed_current)) / int(str(total_orders_current))) * 100, 1)
    cancellation_rate = round((int(str(cancelled_current)) / int(str(total_orders_current))) * 100, 1)

    # ── Litiges ───────────────────────────────────────────────────────────────
    open_disputes = db.query(func.count(models.Dispute.id)).filter(
        models.Dispute.status == "open"
    ).scalar() or 0
    resolved_disputes = db.query(func.count(models.Dispute.id)).filter(
        models.Dispute.status == "resolved"
    ).scalar() or 0

    # ── Province data ─────────────────────────────────────────────────────────
    province_results = db.query(
        models.User.province,
        func.count(models.User.id).label("farmers"),
    ).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES)
    ).group_by(models.User.province).all()

    province_data = []
    for p_name, f_count in province_results:
        orders_pending = db.query(models.Order).join(
            models.User, models.Order.farmer_id == models.User.id
        ).filter(
            models.User.province == p_name,
            models.Order.status.in_(ACTIVE_STATUSES),
        ).count()
        province_data.append({
            "province": p_name or "Inconnue",
            "farmers": f_count,
            "orders_pending": orders_pending,
        })

    # ── Top Farmers ───────────────────────────────────────────────────────────
    top_farmers_query = db.query(
        models.User.name,
        models.User.province,
        func.sum(models.Order.total_price).label("gmv"),
        models.User.rating,
    ).join(models.Order, models.User.id == models.Order.farmer_id).filter(
        models.Order.status.in_(COMPLETED_STATUSES)
    ).group_by(models.User.id).order_by(
        func.sum(models.Order.total_price).desc()
    ).limit(5).all()

    top_farmers = [
        {
            "name": name,
            "province": prov or "Inconnue",
            "gmv": float(str(gmv_val or 0)),
            "rating": float(str(rat or 4.5)),
        }
        for name, prov, gmv_val, rat in top_farmers_query
    ]

    # ── Payouts ───────────────────────────────────────────────────────────────
    payout_beneficiaries = db.query(
        func.count(func.distinct(models.WithdrawalRequest.user_id))
    ).filter(models.WithdrawalRequest.status == "completed").scalar() or 0

    payout_releases = db.query(func.count(models.WithdrawalRequest.id)).filter(
        models.WithdrawalRequest.status == "completed"
    ).scalar() or 0

    # ── Monthly GMV (6 derniers mois) ───────────────────────────────────────
    # Regroupement en Python plutôt qu'en SQL : func.strftime() est propre à
    # SQLite et n'existe pas sur PostgreSQL (utilisé en production).
    completed_orders = db.query(
        models.Order.created_at, models.Order.total_price
    ).filter(models.Order.status.in_(COMPLETED_STATUSES)).all()

    monthly_agg: dict[str, dict] = {}
    for created_at, total_price in completed_orders:
        if not created_at:
            continue
        bucket = monthly_agg.setdefault(created_at.strftime("%Y-%m"), {"gmv": Decimal("0"), "orders": 0})
        bucket["gmv"] += total_price or Decimal("0")
        bucket["orders"] += 1

    monthly_gmv = [
        {"month": month, "gmv": float(data["gmv"]), "orders": data["orders"]}
        for month, data in sorted(monthly_agg.items())[-6:]
    ]
    if not monthly_gmv:
        monthly_gmv = [{"month": now.strftime("%Y-%m"), "gmv": 0, "orders": 0}]

    # ── Notifications ─────────────────────────────────────────────────────────
    from backend.routers.notifications import generate_system_notifications
    recent_notifications = generate_system_notifications(db)

    return {
        "gmv": gmv,
        "active_farmers": active_farmers,
        "active_orders": active_orders,
        "total_payouts": total_payouts,
        "commission_rate": float(str(commission_rate)),
        "total_commission_estimated": float(str(total_commission_estimated)),
        "commission_current_period": float(str(commission_current_period)),
        "kpi_growth": kpi_growth,
        "conversion_rate": conversion_rate,
        "cancellation_rate": cancellation_rate,
        "cancelled_orders_total": cancelled_total,
        "cancelled_orders_current_period": cancelled_current,
        "payout_beneficiaries": payout_beneficiaries,
        "payout_releases": payout_releases,
        "pending_withdrawals": pending_withdrawals,
        "pending_withdrawal_amount": pending_amount,
        "completed_withdrawals": payout_releases,
        "completed_withdrawal_amount": total_payouts,
        "rejected_withdrawals": db.query(func.count(models.WithdrawalRequest.id)).filter(
            models.WithdrawalRequest.status == "rejected"
        ).scalar() or 0,
        "rejected_withdrawal_amount": db.query(func.sum(models.WithdrawalRequest.amount)).filter(
            models.WithdrawalRequest.status == "rejected"
        ).scalar() or Decimal("0.0"),
        "total_withdrawal_requests": db.query(func.count(models.WithdrawalRequest.id)).scalar() or 0,
        "average_withdrawal_amount": db.query(func.avg(models.WithdrawalRequest.amount)).scalar() or Decimal("0.0"),
        "province_data": province_data if province_data else [{"province": "Gitega", "farmers": 0, "orders_pending": 0}],
        "top_farmers": top_farmers,
        "monthly_gmv": monthly_gmv,
        "open_disputes": open_disputes,
        "in_review_disputes": db.query(func.count(models.Dispute.id)).filter(
            models.Dispute.status == "in-review"
        ).scalar() or 0,
        "resolved_disputes": resolved_disputes,
        "high_priority_disputes": db.query(func.count(models.Dispute.id)).filter(models.Dispute.priority == "high").scalar() or 0
    }

@router.get("/weather")
def get_weather_stats(province: str = "Bujumbura"):
    """
    Retourne les données météo réelles pour le dashboard.
    """
    from backend.services.weather_service import weather_service
    weather_data = weather_service.get_weather_forecast(province)
    
    # Adapter au format attendu par WeatherMini
    return {
        "location": weather_data["city"],
        "current": {
            "temp": weather_data["current"]["temp"],
            "condition": weather_data["current"]["description"],
            "humidity": weather_data["current"]["humidity"],
            "wind": weather_data["current"]["wind_speed"]
        },
        "forecast": [
            {
                "day": f["date"], 
                "high": f["temp"], 
                "low": f["temp"] - 4, 
                "icon": "cloud-sun" if "nuage" in f["desc"].lower() else "sun" if "soleil" in f["desc"].lower() else "cloud-rain", 
                "rain": 0
            } for f in weather_data["forecast"]
        ]
    }

@router.get("/tips")
def get_agri_tips(province: str = "Bujumbura"):
    """
    Retourne des conseils et alertes agricoles dynamiques réels.
    """
    from backend.services.weather_service import weather_service
    weather_data = weather_service.get_weather_forecast(province)
    tips = weather_service.get_agricultural_tips(province, weather_data["current"]["description"])
    
    # Adapter au format attendu par WeatherMini
    return [
        {
            "id": i,
            "type": tip["type"],
            "urgency": tip["type"] if tip["type"] in ["high", "medium", "low"] else "medium",
            "title": tip["title"],
            "body": tip["body"]
        } for i, tip in enumerate(tips)
    ]

@router.get("/platform-settings")
def get_public_platform_settings(db: Session = Depends(get_db)):
    """
    Retourne les paramètres publics de la plateforme (commission, etc.)
    Accessible sans authentification admin.
    """
    settings = db.query(models.SystemSettings).first()
    rate = float(cast(Any, settings.commission_rate)) if settings else 0.05
    return {
        "commission_rate": rate,
        "maintenance_mode": settings.maintenance_mode if settings else False,
        "support_phone": settings.support_phone if settings else config.DEFAULT_SUPPORT_PHONE,
        "support_whatsapp": settings.support_whatsapp if settings else config.DEFAULT_SUPPORT_WHATSAPP
    }

@router.get("/farmer/{user_id}", response_model=schemas.FarmerStats)
def get_farmer_stats(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère les statistiques simplifiées pour le portefeuille d'un fermier.
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise.")
    
    if user.id != user_id and not utils.user_has_role(user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    from sqlalchemy import func
    
    # Total Sales (Completed orders)
    sales = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).scalar() or 0
    
    order_count = db.query(func.count(models.Order.id)).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).scalar() or 0
    
    # Pending Payouts (Withdrawals in pending status)
    pending_payout = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.user_id == user_id,
        models.WithdrawalRequest.status == "pending"
    ).scalar() or 0

    # Taux promo d'onboarding (voir payment_service.release_funds_to_farmer) :
    # mêmes statuts que ceux qui déclenchent réellement le versement des fonds.
    completed_sales = db.query(func.count(models.Order.id)).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["delivered", "COMPLETED"]),
    ).scalar() or 0
    current_commission_rate = (
        config.PROMO_COMMISSION_RATE if completed_sales < config.PROMO_SALES_THRESHOLD
        else config.DEFAULT_COMMISSION_RATE
    )
    promo_sales_remaining = max(0, config.PROMO_SALES_THRESHOLD - completed_sales)

    return {
        "balance": target_user.balance,
        "total_sales_bif": sales,
        "order_count": order_count,
        "pending_payout": pending_payout,
        "weekly_sales": [], # Mock for now
        "current_commission_rate": current_commission_rate,
        "promo_sales_remaining": promo_sales_remaining,
    }

@router.get("/farmer/{user_id}/dashboard")
def get_farmer_dashboard_stats(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère les statistiques dynamiques pour le dashboard d'un fermier.
    """
    # Verifier auth
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise.")
    
    # Seul l'utilisateur lui-même ou un admin peut voir
    if user.id != user_id and not utils.user_has_role(user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    from sqlalchemy import func
    
    # Revenue (Paid/Completed orders)
    revenue = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).scalar() or 0
    
    # Pending Orders (Unprocessed or in transit)
    pending_orders_count = db.query(func.count(models.Order.id)).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["PENDING", "PROCESSING", "PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP", "PICKED_UP"])
    ).scalar() or 0
    
    # Products
    total_products = db.query(func.count(models.Product.id)).filter(models.Product.farmer_id == user_id).scalar() or 0
    active_products = db.query(func.count(models.Product.id)).filter(
        models.Product.farmer_id == user_id, 
        models.Product.is_active == True
    ).scalar() or 0
    
    # Products reviews / Rating
    avg_rating = db.query(func.avg(models.ProductReview.rating)).filter(
        models.ProductReview.product_id.in_(
            db.query(models.Product.id).filter(models.Product.farmer_id == user_id)
        )
    ).scalar() or 4.5
    
    # Recent Orders (for PendingOrders list)
    recent_orders = db.query(models.Order).filter(
        models.Order.farmer_id == user_id
    ).order_by(models.Order.created_at.desc()).limit(5).all()
    
    # Weekly Sales (last 7 days)
    # Mock for now but ready for real grouping
    now = datetime.now()
    weekly_sales = []
    for i in range(7):
        day = (now - timedelta(days=i)).strftime("%a")
        weekly_sales.append({"day": day, "value": 0})
    weekly_sales.reverse()

    # Final rating calculation (already done at 308, but making it more solid)
    final_rating = round(float(avg_rating), 1) if avg_rating is not None else 4.5

    return {
        "user": {
            "name": target_user.name,
            "province": target_user.province or "Burundi",
            "balance": float(cast(Any, target_user.balance))
        },
        "stats": {
            "revenue": float(revenue),
            "pending_orders": pending_orders_count,
            "active_products": active_products,
            "total_products": total_products,
            "rating": final_rating
        },
        "weekly_sales": weekly_sales,
        "recent_orders": [
            {
                "id": f"ORD-{o.id:04d}",
                "buyer": o.buyer.name if o.buyer else "Acheteur",
                "status": o.status,
                "amount": float(cast(Any, o.total_price)),
                "date": o.created_at.isoformat()
            } for o in recent_orders
        ]
    }
