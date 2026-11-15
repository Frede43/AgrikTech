from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/disputes",
    tags=["Disputes"]
)

@router.get("/")
def get_disputes(status: Optional[str] = None, request: Request = None, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    query = db.query(models.Dispute).options(
        joinedload(models.Dispute.order),
        joinedload(models.Dispute.buyer),
        joinedload(models.Dispute.farmer),
        joinedload(models.Dispute.driver)
    )
    
    if status and status != "all":
        query = query.filter(models.Dispute.status == status)
    
    # If not admin, only show own disputes
    if not utils.user_has_role(user, "admin"):
        query = query.filter((models.Dispute.buyer_id == user.id) | (models.Dispute.farmer_id == user.id))
        
    disputes = query.order_by(models.Dispute.created_at.desc()).all()
    
    # Transform to rich format for AdminLitigesPage
    results = []
    for d in disputes:
        results.append({
            "id": f"DIS-{d.id:03d}",
            "dbId": d.id,
            "orderId": f"ORD-{d.order_id:03d}" if d.order_id else "N/A",
            "date": d.created_at.isoformat(),
            "buyer": d.buyer.name if d.buyer else "Inconnu",
            "farmer": d.farmer.name if d.farmer else "Inconnu",
            "driver": d.driver.name if d.driver else "Non assigné",
            "reason": d.reason,
            "detail": d.detail,
            "amount": float(d.amount),
            "refundRequested": float(d.refund_requested),
            "status": d.status,
            "priority": d.priority,
            "resolution": d.resolution
        })
    return results

@router.post("/", response_model=schemas.Dispute)
def create_dispute(dispute: schemas.DisputeCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    order = db.query(models.Order).filter(models.Order.id == dispute.order_id).with_for_update().first()
    if not order: raise HTTPException(status_code=404)

    disputable_statuses = {
        "PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP", "PICKED_UP", "COMPLETED", "delivered"
    }
    if str(order.status) not in disputable_statuses:
        raise HTTPException(status_code=409, detail="Cette commande ne peut pas faire l'objet d'un litige dans son état actuel.")

    payment_log = db.query(models.TransactionLog.id).filter(
        models.TransactionLog.order_id == order.id,
        models.TransactionLog.action == "FUNDS_SENT_TO_ESCROW",
    ).first()
    if not payment_log:
        raise HTTPException(status_code=409, detail="Le paiement de cette commande n'est pas confirmé.")
    
    # Check if user involved
    if order.buyer_id != user.id and order.farmer_id != user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas partie prenante de cette commande.")

    existing_dispute = db.query(models.Dispute.id).filter(
        models.Dispute.order_id == order.id
    ).first()
    if existing_dispute:
        raise HTTPException(status_code=409, detail="Un litige existe déjà pour cette commande.")
    order_total = Decimal(str(order.total_price or 0))
    if (
        not dispute.refund_requested.is_finite()
        or dispute.refund_requested < 0
        or dispute.refund_requested > order_total
    ):
        raise HTTPException(status_code=400, detail="Montant de remboursement demandé invalide.")
        
    db_dispute = models.Dispute(
        order_id=order.id,
        buyer_id=order.buyer_id,
        farmer_id=order.farmer_id,
        driver_id=order.driver_id,
        reason=dispute.reason,
        detail=dispute.detail,
        amount=order.total_price,
        refund_requested=dispute.refund_requested,
        status="open",
        priority=dispute.priority or "medium",
        pre_dispute_status=order.status,
    )
    
    order.status = "DISPUTED"
    db.add(db_dispute)
    db.commit()
    db.refresh(db_dispute)
    return db_dispute

@router.put("/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: int, 
    payload: schemas.DisputeResolve, 
    request: Request, 
    db: Session = Depends(get_db)
):
    """
    Résout un litige administrativement. 
    Peut déclencher un remboursement partiel ou total.
    """
    admin = utils.get_authenticated_user(request, db)
    if not admin or not utils.user_has_role(admin, "admin"):
        raise HTTPException(status_code=403, detail="Réservé aux admins.")
        
    dispute = db.query(models.Dispute).filter(
        models.Dispute.id == dispute_id
    ).with_for_update().first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Litige non trouvé.")

    if dispute.status not in ("open", "in-review", "in_review"):
        raise HTTPException(status_code=409, detail="Ce litige a déjà été traité.")

    order = db.query(models.Order).filter(
        models.Order.id == dispute.order_id
    ).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande du litige introuvable.")
    order_total = Decimal(str(order.total_price or 0))
    if (
        not payload.refund_amount.is_finite()
        or payload.refund_amount < 0
        or payload.refund_amount > order_total
    ):
        raise HTTPException(status_code=400, detail="Montant de remboursement invalide.")
    refund_requested = Decimal(str(dispute.refund_requested or 0))
    if not refund_requested.is_finite():
        raise HTTPException(status_code=409, detail="Montant demandé enregistré invalide.")
    if payload.refund_amount > refund_requested:
        raise HTTPException(status_code=400, detail="Le remboursement dépasse le montant demandé.")
    if payload.status not in ("resolved", "rejected"):
        raise HTTPException(status_code=400, detail="Statut de résolution invalide.")
    if payload.status == "rejected" and payload.refund_amount > 0:
        raise HTTPException(status_code=400, detail="Un litige rejeté ne peut pas générer de remboursement.")
    if payload.refund_amount > 0 and order.status != "DISPUTED":
        raise HTTPException(status_code=409, detail="La commande n'est plus en état de remboursement.")
        
    dispute.status = payload.status
    dispute.resolution = payload.resolution
    
    # Gérer le remboursement si nécessaire
    if payload.refund_amount > 0:
        pre_dispute_status = str(dispute.pre_dispute_status or "")
        if pre_dispute_status in ("COMPLETED", "delivered"):
            farmer = db.query(models.User).filter(
                models.User.id == order.farmer_id
            ).populate_existing().with_for_update().first()
            if not farmer:
                raise HTTPException(status_code=404, detail="Fermier du litige introuvable.")
            farmer_balance = Decimal(str(farmer.balance or 0))
            if farmer_balance < payload.refund_amount:
                raise HTTPException(
                    status_code=409,
                    detail="Le solde disponible du fermier ne couvre pas ce remboursement.",
                )
            farmer.balance -= payload.refund_amount
            db.add(models.TransactionLog(
                user_id=farmer.id,
                order_id=order.id,
                amount=-payload.refund_amount,
                action="DISPUTE_REFUND_DEBIT",
            ))

        buyer = db.query(models.User).filter(
            models.User.id == order.buyer_id
        ).populate_existing().with_for_update().first()
        if not buyer:
            raise HTTPException(status_code=404, detail="Acheteur du litige introuvable.")
        buyer.balance += payload.refund_amount
        db.add(models.TransactionLog(
            user_id=buyer.id,
            order_id=order.id,
            amount=payload.refund_amount,
            action="DISPUTE_REFUND"
        ))

    # Un rejet ou une résolution sans remboursement remet la commande dans
    # son état précédent pour que la livraison puisse reprendre. Une commande
    # déjà livrée garde son statut après compensation; une commande encore en
    # cours reste DISPUTED pour empêcher livraison et versement au fermier.
    pre_dispute_status = str(dispute.pre_dispute_status or "")
    was_completed = pre_dispute_status in ("COMPLETED", "delivered")
    if dispute.pre_dispute_status and (payload.refund_amount == 0 or was_completed):
        order.status = dispute.pre_dispute_status
            
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action=f"DISPUTE_{payload.status.upper()}",
        entity_type="dispute",
        entity_id=dispute.id,
        detail=f"Litige résolu. Remboursement: {payload.refund_amount} BIF. Note: {payload.resolution}"
    ))
    
    db.commit()
    return {"message": "Litige traité avec succès."}
