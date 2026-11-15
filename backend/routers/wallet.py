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

    channel = payload.channel or "Lumicash"
    phone = payload.phone_number or user.phone_number

    # UPDATE atomique : deux demandes concurrentes ne peuvent pas débiter le
    # même solde chargé auparavant ni créer des retraits au-delà du disponible.
    debited = db.query(models.User).filter(
        models.User.id == user.id,
        models.User.balance >= amount,
    ).update(
        {models.User.balance: models.User.balance - amount},
        synchronize_session=False,
    )
    if debited != 1:
        db.rollback()
        raise HTTPException(status_code=400, detail="Solde insuffisant.")
    db.flush()

    # Les retraits sont versés manuellement : une demande reste en attente tant
    # qu'un administrateur n'a pas saisi la référence du paiement réellement envoyé.
    status = "pending"
    note = "Demande reçue. Le paiement sera marqué terminé après le versement manuel."
    message = "Retrait soumis. Le versement sera traité manuellement."

    withdrawal = models.WithdrawalRequest(
        user_id=user.id,
        amount=amount,
        channel=channel,
        phone_number=phone,
        status=status,
        note=note,
    )
    db.add(withdrawal)
    db.flush()

    db.add(models.AdminAuditLog(
        admin_user_id=user.id, action="WITHDRAWAL_REQUESTED",
        entity_type="withdrawal_request", entity_id=withdrawal.id,
        detail=f"Retrait de {amount} BIF via {channel} par {user.name}",
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
