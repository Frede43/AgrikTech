from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import models, schemas, utils, config
from database import get_db
from services.market_service import market_service

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

import fastapi

@router.get("/admin", response_model=schemas.AdminStats)
def get_admin_stats(request: fastapi.Request, db: Session = Depends(get_db)):
    """
    Récupère les statistiques globales KPI pour l'administration AgriConnect.
    """
    # Chargement des KPIs (Burundi Admin)
    print("Chargement des KPIs Admin...")
    from routers.admin import check_admin_auth
    check_admin_auth(request, db)
    
    from sqlalchemy import func
    
    # KPI 1: GMV (Total des ventes payées ou terminées)
    gmv = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).scalar() or Decimal("0.0")
    
    # KPI 2: Fermiers actifs
    active_farmers = db.query(func.count(models.User.id)).filter(
        models.User.role.in_(config.FARMER_ROLE_VALUES),
        models.User.is_active == True
    ).scalar() or 0
    
    # KPI 3: Commandes actives (en cours de traitement)
    active_orders = db.query(func.count(models.Order.id)).filter(
        models.Order.status.in_(["PENDING", "PROCESSING", "SHIPPED", "DISPUTED"])
    ).scalar() or 0
    
    # KPI 4: Retraits complétés
    total_payouts = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "completed"
    ).scalar() or Decimal("0.0")
    
    # Retraits en attente
    pending_withdrawals = db.query(func.count(models.WithdrawalRequest.id)).filter(
        models.WithdrawalRequest.status == "pending"
    ).scalar() or 0
    pending_amount = db.query(func.sum(models.WithdrawalRequest.amount)).filter(
        models.WithdrawalRequest.status == "pending"
    ).scalar() or Decimal("0.0")
    
    # Litiges
    open_disputes = db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "open").scalar() or 0
    resolved_disputes = db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "resolved").scalar() or 0
    
    # Province data (Top provinces par volume de produits/fermiers)
    province_results = db.query(
        models.User.province, 
        func.count(models.User.id).label("farmers"),
    ).filter(models.User.role.in_(config.FARMER_ROLE_VALUES)).group_by(models.User.province).all()
    
    province_data = []
    for p_name, f_count in province_results:
        # Count pending orders in this province (via product farmer)
        orders_pending = db.query(models.Order).join(models.User, models.Order.farmer_id == models.User.id).filter(
            models.User.province == p_name,
            models.Order.status == "PENDING"
        ).count()
        province_data.append({
            "province": p_name or "Inconnue", 
            "farmers": f_count,
            "orders_pending": orders_pending
        })
    
    # Top Farmers
    top_farmers_query = db.query(
        models.User.name,
        models.User.province,
        func.sum(models.Order.total_price).label("gmv"),
        models.User.rating
    ).join(models.Order, models.User.id == models.Order.farmer_id).filter(
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).group_by(models.User.id).order_by(func.sum(models.Order.total_price).desc()).limit(5).all()
    
    top_farmers = []
    for name, prov, gmv_val, rat in top_farmers_query:
        top_farmers.append({
            "name": name,
            "province": prov or "Inconnue",
            "gmv": float(gmv_val),
            "rating": float(rat or 4.5)
        })

    # Payouts
    payout_beneficiaries = db.query(func.count(func.distinct(models.WithdrawalRequest.user_id))).filter(
        models.WithdrawalRequest.status == "completed"
    ).scalar() or 0
    payout_releases = db.query(func.count(models.WithdrawalRequest.id)).filter(
        models.WithdrawalRequest.status == "completed"
    ).scalar() or 0

    # Monthly GMV (Simple grouping by month)
    monthly_results = db.query(
        func.strftime("%Y-%m", models.Order.created_at).label("month"),
        func.sum(models.Order.total_price).label("gmv")
    ).filter(
        models.Order.status.in_(["PAID", "COMPLETED", "DELIVERED"])
    ).group_by("month").order_by("month").limit(6).all()
    
    monthly_gmv = [{"month": m, "gmv": float(g)} for m, g in monthly_results]
    if not monthly_gmv:
        monthly_gmv = [{"month": "2024-03", "gmv": 0}]

    from routers.notifications import generate_system_notifications
    recent_notifications = generate_system_notifications(db)

    return {
        "gmv": gmv,
        "active_farmers": active_farmers,
        "active_orders": active_orders,
        "total_payouts": total_payouts,
        "commission_rate": config.DEFAULT_COMMISSION_RATE,
        "payout_beneficiaries": payout_beneficiaries,
        "payout_releases": payout_releases,
        "province_data": province_data if province_data else [{"province": "Gitega", "farmers": 0, "orders_pending": 0}],
        "monthly_gmv": monthly_gmv,
        "top_farmers": top_farmers, 
        "recent_notifications": recent_notifications[:5],
        "open_disputes": open_disputes,
        "unread_notifications": len([n for n in recent_notifications if not n.get("read")]),
        "pending_withdrawals": pending_withdrawals,
        "pending_withdrawal_amount": pending_amount,
        "completed_withdrawals": payout_releases,
        "completed_withdrawal_amount": total_payouts,
        "rejected_withdrawals": db.query(func.count(models.WithdrawalRequest.id)).filter(models.WithdrawalRequest.status == "rejected").scalar() or 0,
        "rejected_withdrawal_amount": db.query(func.sum(models.WithdrawalRequest.amount)).filter(models.WithdrawalRequest.status == "rejected").scalar() or Decimal("0.0"),
        "total_withdrawal_requests": db.query(func.count(models.WithdrawalRequest.id)).scalar() or 0,
        "average_withdrawal_amount": db.query(func.avg(models.WithdrawalRequest.amount)).scalar() or Decimal("0.0"),
        "in_review_disputes": db.query(func.count(models.Dispute.id)).filter(models.Dispute.status == "in-review").scalar() or 0,
        "resolved_disputes": resolved_disputes,
        "high_priority_disputes": db.query(func.count(models.Dispute.id)).filter(models.Dispute.priority == "high").scalar() or 0
    }

@router.get("/weather")
def get_weather_stats():
    """
    Retourne les données météo pour le dashboard.
    En production, ceci appellerait une API météo réelle.
    """
    return {
        "location": "Gitega, Burundi",
        "current": {
            "temp": 24,
            "condition": "Partiellement Nuageux",
            "humidity": 65,
            "wind": 12
        },
        "forecast": [
            {"day": "Lun", "high": 27, "low": 18, "icon": "sun", "rain": 10},
            {"day": "Mar", "high": 26, "low": 17, "icon": "cloud-sun", "rain": 25},
            {"day": "Mer", "high": 22, "low": 16, "icon": "cloud-rain", "rain": 85},
            {"day": "Jeu", "high": 24, "low": 16, "icon": "cloud-rain", "rain": 40},
            {"day": "Ven", "high": 25, "low": 17, "icon": "cloud-sun", "rain": 15}
        ]
    }

@router.get("/platform-settings")
def get_public_platform_settings(db: Session = Depends(get_db)):
    """
    Retourne les paramètres publics de la plateforme (commission, etc.)
    Accessible sans authentification admin.
    """
    settings = db.query(models.SystemSettings).first()
    rate = float(settings.commission_rate) if settings else 0.05
    return {
        "commission_rate": rate,
        "maintenance_mode": settings.maintenance_mode if settings else False,
        "support_phone": settings.support_phone if settings else config.DEFAULT_SUPPORT_PHONE,
        "support_whatsapp": settings.support_whatsapp if settings else config.DEFAULT_SUPPORT_WHATSAPP
    }

@router.get("/tips")
def get_agri_tips():
    """
    Retourne des conseils et alertes agricoles dynamiques.
    """
    return [
        {
            "id": 1,
            "type": "weather",
            "urgency": "high",
            "title": "Alerte Pluie Forte (Mercredi)",
            "body": "Des précipitations importantes sont prévues. Pensez à protéger vos récoltes sensibles et à vérifier l'évacuation des eaux."
        },
        {
            "id": 2,
            "type": "market",
            "urgency": "medium",
            "title": "Opportunité Haricot Jaune",
            "body": "La demande est en hausse à Bujumbura. C'est le bon moment pour récolter si vos stocks sont prêts."
        },
        {
            "id": 3,
            "type": "crop",
            "urgency": "low",
            "title": "Conseil Fertilité",
            "body": "Pensez à alterner vos cultures de maïs avec des légumineuses pour préserver l'azote du sol dans la région de Gitega."
        }
    ]

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

    return {
        "balance": target_user.balance,
        "total_sales_bif": sales,
        "order_count": order_count,
        "pending_payout": pending_payout,
        "weekly_sales": [] # Mock for now
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
            "balance": float(target_user.balance)
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
                "amount": float(o.total_price),
                "date": o.created_at.isoformat()
            } for o in recent_orders
        ]
    }
