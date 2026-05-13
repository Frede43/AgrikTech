from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal

import backend.models as models
import backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Générateurs de notifications par rôle
# ─────────────────────────────────────────────────────────────────────────────

def _dismissed_ids(db: Session, user_id: int) -> set:
    """Retourne l'ensemble des notification_id déjà rejetés par l'utilisateur."""
    rows = (
        db.query(models.NotificationDismissal.notification_id)
        .filter(models.NotificationDismissal.user_id == user_id)
        .all()
    )
    return {r.notification_id for r in rows}


def generate_admin_notifications(db: Session, dismissed: set) -> List[dict]:
    """Notifications dynamiques pour les administrateurs."""
    notifications = []

    # Retraits en attente
    pending_wd = db.query(models.WithdrawalRequest).filter(
        models.WithdrawalRequest.status == "pending"
    ).count()
    nid = "notif-wdr-pending"
    if pending_wd > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "payout",
            "title": "Retraits en attente",
            "body": f"{pending_wd} demande(s) de retrait à valider.",
            "time": "Maintenant",
            "read": False,
            "priority": "high" if pending_wd > 2 else "medium",
            "reference": "ADMIN/WDR",
            "dismissible": True,
        })

    # Litiges ouverts
    open_disputes = db.query(models.Dispute).filter(
        models.Dispute.status == "open"
    ).count()
    nid = "notif-dispute-open"
    if open_disputes > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "dispute",
            "title": "Litiges ouverts",
            "body": f"{open_disputes} litige(s) nécessite(nt) votre attention.",
            "time": "Urgent",
            "read": False,
            "priority": "high",
            "reference": "ADMIN/DIS",
            "dismissible": True,
        })

    # Témoignages à modérer
    pending_testi = db.query(models.Testimonial).filter(
        models.Testimonial.status == "pending"
    ).count()
    nid = "notif-testi-pending"
    if pending_testi > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "testimonial",
            "title": "Témoignages à modérer",
            "body": f"{pending_testi} témoignage(s) en attente de publication.",
            "time": "Aujourd'hui",
            "read": False,
            "priority": "low",
            "reference": "ADMIN/TESTI",
            "dismissible": True,
        })

    # KYC en attente
    pending_kyc = db.query(models.User).filter(
        models.User.kyc_status == "pending"
    ).count()
    nid = "notif-kyc-pending"
    if pending_kyc > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "system",
            "title": "Dossiers KYC en attente",
            "body": f"{pending_kyc} dossier(s) KYC à vérifier avant autorisation de retrait.",
            "time": "Aujourd'hui",
            "read": False,
            "priority": "medium",
            "reference": "ADMIN/KYC",
            "dismissible": True,
        })

    # Commandes annulées récentes (dernières 24h)
    from datetime import timedelta
    cutoff = utils.utcnow_naive() - timedelta(hours=24)
    cancelled_recent = db.query(models.Order).filter(
        models.Order.status == "CANCELLED",
        models.Order.created_at >= cutoff,
    ).count()
    nid = "notif-cancelled-recent"
    if cancelled_recent > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "stock",
            "title": "Annulations récentes",
            "body": f"{cancelled_recent} commande(s) annulée(s) dans les dernières 24h.",
            "time": "24h",
            "read": False,
            "priority": "low",
            "reference": "ADMIN/CANCEL",
            "dismissible": True,
        })

    return notifications


def generate_farmer_notifications(db: Session, user_id: int, dismissed: set) -> List[dict]:
    """Notifications dynamiques pour les fermiers."""
    notifications = []

    # Commandes en attente de collecte
    pending_orders = db.query(models.Order).filter(
        models.Order.farmer_id == user_id,
        models.Order.status.in_(["PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP"]),
    ).count()
    nid = f"notif-farmer-{user_id}-pending-orders"
    if pending_orders > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "stock",
            "title": "Commandes à préparer",
            "body": f"{pending_orders} commande(s) en attente de collecte par le livreur.",
            "time": "Maintenant",
            "read": False,
            "priority": "high" if pending_orders > 3 else "medium",
            "reference": None,
            "dismissible": True,
        })

    # Produits en rupture de stock
    low_stock = db.query(models.Product).filter(
        models.Product.farmer_id == user_id,
        models.Product.is_active == True,
        models.Product.quantity_kg <= models.Product.min_stock,
    ).count()
    nid = f"notif-farmer-{user_id}-low-stock"
    if low_stock > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "stock",
            "title": "Stock faible",
            "body": f"{low_stock} produit(s) en dessous du seuil minimum. Pensez à mettre à jour votre stock.",
            "time": "Aujourd'hui",
            "read": False,
            "priority": "medium",
            "reference": None,
            "dismissible": True,
        })

    # Solde disponible (rappel de retrait)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    nid = f"notif-farmer-{user_id}-balance"
    if user and float(str(user.balance or 0)) > 10000 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "payout",
            "title": "Solde disponible",
            "body": f"Vous avez {float(str(user.balance or 0)):.0f} BIF disponibles dans votre portefeuille.",
            "time": "Disponible",
            "read": False,
            "priority": "low",
            "reference": None,
            "dismissible": True,
        })

    # KYC non vérifié
    nid = f"notif-farmer-{user_id}-kyc"
    if user and user.kyc_status == "pending" and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "system",
            "title": "Vérification KYC requise",
            "body": "Votre dossier KYC est en attente. Complétez-le pour activer les retraits.",
            "time": "Action requise",
            "read": False,
            "priority": "high",
            "reference": None,
            "dismissible": False,
        })

    return notifications


def generate_buyer_notifications(db: Session, user_id: int, dismissed: set) -> List[dict]:
    """Notifications dynamiques pour les acheteurs."""
    notifications = []

    # Commandes en transit
    in_transit = db.query(models.Order).filter(
        models.Order.buyer_id == user_id,
        models.Order.status.in_(["PICKED_UP", "IN_TRANSIT", "READY_FOR_PICKUP"]),
    ).count()
    nid = f"notif-buyer-{user_id}-in-transit"
    if in_transit > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "stock",
            "title": "Commande en route",
            "body": f"{in_transit} commande(s) en cours de livraison. Préparez votre code OTP.",
            "time": "En cours",
            "read": False,
            "priority": "high",
            "reference": None,
            "dismissible": True,
        })

    # Commandes récemment livrées (à évaluer)
    from datetime import timedelta
    cutoff = utils.utcnow_naive() - timedelta(days=3)
    completed = db.query(models.Order).filter(
        models.Order.buyer_id == user_id,
        models.Order.status == "COMPLETED",
        models.Order.created_at >= cutoff,
    ).count()
    nid = f"notif-buyer-{user_id}-rate"
    if completed > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "testimonial",
            "title": "Évaluez votre commande",
            "body": "Votre commande est arrivée ! Partagez votre expérience pour aider les autres acheteurs.",
            "time": "Récemment livré",
            "read": False,
            "priority": "low",
            "reference": None,
            "dismissible": True,
        })

    return notifications


def generate_driver_notifications(db: Session, user_id: int, dismissed: set) -> List[dict]:
    """Notifications dynamiques pour les livreurs."""
    notifications = []

    # Commandes assignées non collectées
    assigned = db.query(models.Order).filter(
        models.Order.driver_id == user_id,
        models.Order.status.in_(["READY_FOR_PICKUP", "CONFIRMED"]),
    ).count()
    nid = f"notif-driver-{user_id}-assigned"
    if assigned > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "stock",
            "title": "Collecte en attente",
            "body": f"{assigned} commande(s) assignée(s) à collecter chez le fermier.",
            "time": "Maintenant",
            "read": False,
            "priority": "high",
            "reference": None,
            "dismissible": True,
        })

    # Commandes en transit (à livrer)
    picked = db.query(models.Order).filter(
        models.Order.driver_id == user_id,
        models.Order.status == "PICKED_UP",
    ).count()
    nid = f"notif-driver-{user_id}-picked"
    if picked > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "system",
            "title": "Livraison en cours",
            "body": f"{picked} colis à livrer. Utilisez l'OTP de l'acheteur à la remise.",
            "time": "En route",
            "read": False,
            "priority": "medium",
            "reference": None,
            "dismissible": True,
        })

    # Pool disponible
    pool_count = db.query(models.Order).filter(
        models.Order.driver_id == None,
        models.Order.status.in_(["PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP"]),
    ).count()
    nid = f"notif-driver-{user_id}-pool"
    if pool_count > 0 and nid not in dismissed:
        notifications.append({
            "id": nid,
            "type": "payout",
            "title": "Missions disponibles",
            "body": f"{pool_count} commande(s) disponible(s) dans le pool. Acceptez une mission !",
            "time": "Disponible",
            "read": False,
            "priority": "low",
            "reference": None,
            "dismissible": True,
        })

    return notifications


def generate_system_notifications(db: Session) -> List[dict]:
    """
    Alias public pour la compatibilité avec stats.py (admin dashboard).
    Génère sans filtrage de dismissed.
    """
    return generate_admin_notifications(db, dismissed=set())


# ─────────────────────────────────────────────────────────────────────────────
# Routes API
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=List[dict])
@router.get("/{user_id}/", response_model=List[dict])
def list_user_notifications(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Retourne les notifications personnalisées selon le rôle de l'utilisateur.
    Respecte les notifications déjà rejetées (NotificationDismissal).
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session requise.")
    if current_user.id != user_id and not utils.user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    dismissed = _dismissed_ids(db, int(str(current_user.id)))
    role = utils.normalize_role(str(current_user.role)) or ""

    if role == "admin":
        return generate_admin_notifications(db, dismissed)
    elif role == "fermier":
        return generate_farmer_notifications(db, int(str(current_user.id)), dismissed)
    elif role == "acheteur":
        return generate_buyer_notifications(db, int(str(current_user.id)), dismissed)
    elif role == "logistique":
        return generate_driver_notifications(db, int(str(current_user.id)), dismissed)

    return []


@router.post("/{user_id}/dismiss")
def dismiss_notification(
    user_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Marque une notification comme rejetée (dismissed) par l'utilisateur.
    Elle ne réapparaîtra plus jusqu'à ce que la condition sous-jacente change.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session requise.")
    if current_user.id != user_id and not utils.user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    notification_id = payload.get("notification_id", "").strip()
    if not notification_id:
        raise HTTPException(status_code=400, detail="notification_id manquant.")

    # Idempotent : ne crée pas de doublon
    existing = db.query(models.NotificationDismissal).filter(
        models.NotificationDismissal.user_id == current_user.id,
        models.NotificationDismissal.notification_id == notification_id,
    ).first()

    if not existing:
        db.add(models.NotificationDismissal(
            user_id=current_user.id,
            notification_id=notification_id,
        ))
        db.commit()

    return {"dismissed": True, "notification_id": notification_id}
