from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas, config, utils
from database import get_db

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
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    # KYC Check (BRB Requirement)
    if user.kyc_status != "verified":
        raise HTTPException(status_code=403, detail="KYC requis pour les retraits.")
        
    amount = config.Decimal(str(payload.amount))
    if user.balance < amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant.")
        
    if amount < config.MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum {config.MIN_WITHDRAWAL_AMOUNT} BIF.")
        
    # Create request
    withdrawal = models.WithdrawalRequest(
        user_id=user.id,
        amount=amount,
        status="pending",
        channel=payload.channel or "Lumicash",
        phone_number=payload.phone_number or user.phone_number
    )
    user.balance -= amount
    db.add(withdrawal)
    db.commit()
    
    return {"message": "Demande de retrait envoyée.", "id": withdrawal.id}
