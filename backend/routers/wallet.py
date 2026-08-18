from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/wallet",
    tags=["Wallet"]
)

@router.get("/balance")
def get_balance(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    return {"balance": user.balance, "currency": "BIF"}

@router.post("/withdrawals")
def request_withdrawal(payload: schemas.WalletWithdrawalRequest, request: Request, db: Session = Depends(get_db)):
    # NB : `payload.user_id` n'est jamais utilisé ici — seul l'utilisateur de
    # la session authentifiée peut initier un retrait sur SON solde, jamais
    # celui indiqué (potentiellement falsifié) dans le corps de la requête.
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)

    if user.role not in config.FARMER_ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Seuls les fermiers peuvent effectuer des retraits.")

    # KYC Check (BRB Requirement)
    if user.kyc_status != "verified":
        raise HTTPException(status_code=403, detail="KYC requis pour les retraits.")

    amount = config.Decimal(str(payload.amount))
    if amount < config.MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum {config.MIN_WITHDRAWAL_AMOUNT} BIF.")

    if config.Decimal(str(user.balance or 0)) < amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant.")

    channel = payload.channel or "Lumicash"
    phone = payload.phone_number or user.phone_number

    user.balance = config.Decimal(str(user.balance or 0)) - amount
    db.flush()

    # Contrôles anti-fraude : un retrait n'est traité (et crédité) immédiatement
    # que si TOUTES ces conditions sont réunies ; sinon il reste "pending" pour
    # revue manuelle par un admin (voir routers/admin.py approve/reject).
    has_delivery_history = (
        db.query(models.Order.id).filter(
            models.Order.farmer_id == user.id,
            models.Order.status == "COMPLETED",
        ).first() is not None
    ) or (
        db.query(models.WithdrawalRequest.id).filter(
            models.WithdrawalRequest.user_id == user.id,
            models.WithdrawalRequest.status == "completed",
        ).first() is not None
    )
    phone_matches = phone == user.phone_number
    under_review_threshold = amount <= config.AUTO_WITHDRAWAL_REVIEW_THRESHOLD

    if not has_delivery_history:
        status = "pending"
        note = "Votre demande sera traitée sous 24h après validation de votre compte."
        message = "Retrait soumis. Un historique confirmé est requis pour le traitement automatique."
    elif not phone_matches:
        status = "pending"
        note = (
            f"Le numéro principal du compte ({user.phone_number}) diffère du numéro de retrait fourni. "
            f"Votre demande sera traitée sous 24h."
        )
        message = "Votre demande de retrait sera traitée sous 24h."
    elif not under_review_threshold:
        status = "pending"
        note = "Retrait supérieur à 25 000 BIF — vérification manuelle requise. Votre demande sera traitée sous 24h."
        message = "Votre demande de retrait sera traitée sous 24h."
    else:
        status = "completed"
        note = "Traité automatiquement après contrôles de sécurité."
        message = "Votre retrait a été traité automatiquement."

    withdrawal = models.WithdrawalRequest(
        user_id=user.id,
        amount=amount,
        channel=channel,
        phone_number=phone,
        status=status,
        note=note,
    )
    if status == "completed":
        withdrawal.processed_at = utils.utcnow_naive()
    db.add(withdrawal)
    db.flush()

    db.add(models.AdminAuditLog(
        admin_user_id=user.id, action="WITHDRAWAL_REQUESTED",
        entity_type="withdrawal_request", entity_id=withdrawal.id,
        detail=f"Retrait de {amount} BIF via {channel} par {user.name}",
    ))
    if status == "completed":
        db.add(models.AdminAuditLog(
            admin_user_id=None, action="WITHDRAWAL_APPROVED",
            entity_type="withdrawal_request", entity_id=withdrawal.id,
            detail="Approuvé automatiquement.",
        ))

    db.commit()
    db.refresh(withdrawal)
    db.refresh(user)

    return {
        "id": f"WDR-{withdrawal.id}",
        "dbId": withdrawal.id,
        "status": status,
        "channel": channel,
        "phone_number": phone,
        "balance": float(str(user.balance)),
        "message": message,
        "note": note,
    }
