from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


def generate_system_notifications(db: Session) -> List[dict]:
    """
    Génère dynamiquement des notifications "système" basées sur l'état de la base.
    Utilisable en interne par l'admin dashboard ou via l'API.
    """
    notifications = []
    from sqlalchemy import func
    
    # 1. Alertes Retraits
    pending_withdrawals = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.status == "pending").count()
    if pending_withdrawals > 0:
        notifications.append({
            "id": "notif-wdr-pending",
            "type": "payout",
            "title": "Retraits en attente",
            "body": f"Il y a {pending_withdrawals} demande(s) de retrait à valider.",
            "time": "Maintenant",
            "read": False,
            "priority": "high" if pending_withdrawals > 2 else "medium",
            "reference": "ADMIN/WDR"
        })
        
    # 2. Alertes Litiges
    open_disputes = db.query(models.Dispute).filter(models.Dispute.status == "open").count()
    if open_disputes > 0:
        notifications.append({
            "id": "notif-dispute-open",
            "type": "dispute",
            "title": "Litiges ouverts",
            "body": f"{open_disputes} litige(s) nécessite(nt) votre attention.",
            "time": "Urgent",
            "read": False,
            "priority": "high",
            "reference": "ADMIN/DIS"
        })
        
    # 3. Alertes Témoignages
    pending_testimonials = db.query(models.Testimonial).filter(models.Testimonial.status == "pending").count()
    if pending_testimonials > 0:
        notifications.append({
            "id": "notif-testi-pending",
            "type": "testimonial",
            "title": "Témoignages à modérer",
            "body": f"{pending_testimonials} nouveau(x) témoignage(s) en attente de publication.",
            "time": "Aujourd'hui",
            "read": False,
            "priority": "low",
            "reference": "ADMIN/TESTI"
        })
        
    return notifications

@router.get("/{user_id}", response_model=List[dict])
@router.get("/{user_id}/", response_model=List[dict])
def list_user_notifications(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Route API pour lister les notifications.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session requise.")
    
    # Pour l'instant on ne montre que les alertes système aux admins
    if not utils.user_has_role(current_user, "admin"):
        return []

    return generate_system_notifications(db)
