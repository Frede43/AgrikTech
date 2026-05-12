from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

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
    
    order = db.query(models.Order).filter(models.Order.id == dispute.order_id).first()
    if not order: raise HTTPException(status_code=404)
    
    # Check if user involved
    if order.buyer_id != user.id and order.farmer_id != user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas partie prenante de cette commande.")
        
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
    )
    
    order.status = "DISPUTED"
    db.add(db_dispute)
    db.commit()
    db.refresh(db_dispute)
    return db_dispute
