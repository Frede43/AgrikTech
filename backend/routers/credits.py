from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Any, cast
from datetime import datetime

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(prefix="/credits", tags=["Credits"])

@router.post("/request", response_model=schemas.CreditRequest)
def request_credit(payload: schemas.CreditRequestCreate, request: Request, db: Session = Depends(get_db)):
    """
    Un fermier demande une avance de crédit sur sa récolte.
    """
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    if not utils.user_has_role(user, "farmer"):
        raise HTTPException(status_code=403, detail="Réservé aux fermiers.")
    
    # Vérifier KYC
    if user.kyc_status != "approved":
        raise HTTPException(status_code=403, detail="KYC non approuvé. Crédit impossible.")
    
    db_credit = models.CreditRequest(
        user_id=user.id,
        amount_requested=payload.amount_requested,
        reason=payload.reason,
        harvest_estimate_kg=payload.harvest_estimate_kg,
        product_type=payload.product_type,
        status="pending"
    )
    db.add(db_credit)
    db.commit()
    db.refresh(db_credit)
    return db_credit

@router.get("/me", response_model=List[schemas.CreditRequest])
def my_credits(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    return db.query(models.CreditRequest).filter(models.CreditRequest.user_id == user.id).all()

@router.get("/", response_model=List[schemas.CreditRequest])
def all_credits(request: Request, db: Session = Depends(get_db)):
    """Admin: voir toutes les demandes de crédit."""
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "admin"):
        raise HTTPException(status_code=403)
    return db.query(models.CreditRequest).order_by(models.CreditRequest.created_at.desc()).all()

@router.put("/{credit_id}/review")
def review_credit(credit_id: int, action: str, request: Request, db: Session = Depends(get_db)):
    """Admin: approuver ou rejeter une demande. action = 'approve' ou 'reject'"""
    admin = utils.get_authenticated_user(request, db)
    if not admin or not utils.user_has_role(admin, "admin"):
        raise HTTPException(status_code=403)
    
    credit = db.query(models.CreditRequest).filter(models.CreditRequest.id == credit_id).first()
    if not credit: raise HTTPException(status_code=404, detail="Demande non trouvée.")
    
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action invalide. Utiliser 'approve' ou 'reject'.")
    
    credit.status = cast(Any, "approved" if action == "approve" else "rejected")
    credit.reviewed_at = cast(Any, utils.utcnow_naive())
    
    # Si approuvé, créditer le solde du fermier
    if credit.status == "approved":
        farmer = db.query(models.User).filter(models.User.id == credit.user_id).first()
        if farmer:
            farmer.balance += credit.amount_requested
            db.add(models.TransactionLog(
                user_id=farmer.id,
                amount=credit.amount_requested,
                action="CREDIT_DISBURSEMENT"
            ))
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action=f"CREDIT_{credit.status.upper()}",
        entity_type="credit_request",
        entity_id=credit.id,
        detail=f"Crédit {credit.status}: {credit.amount_requested} BIF"
    ))
    
    db.commit()
    return {"message": f"Demande {credit.status}", "credit_id": credit_id}
