from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import Dict, Optional
from datetime import datetime, timedelta

import models, schemas, config, utils
from database import get_db
from services.sms_service import sms_service
from services import user_service

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# In-memory store (temp pour OTP)
pending_otps: Dict[str, str] = {}
# Rate limit tracking (en prod use Redis)
otp_request_cooldowns: Dict[str, datetime] = {}

@router.post("/request-otp")
def request_otp(phone_number: str, db: Session = Depends(get_db)):
    # Rate limit (1 request per 60s per phone number)
    now = datetime.now()
    if phone_number in otp_request_cooldowns:
        last_request = otp_request_cooldowns[phone_number]
        if now < last_request + timedelta(seconds=60):
            wait_time = int((last_request + timedelta(seconds=60) - now).total_seconds())
            raise HTTPException(
                status_code=429, 
                detail=f"Trop de tentatives. Veuillez attendre {wait_time} secondes."
            )

    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user and not user.is_active:
        pending_otps.pop(phone_number, None)
        raise HTTPException(status_code=403, detail="Ce numéro a été suspendue. Contactez l'administrateur.")

    otp = sms_service.generate_otp()
    if sms_service.send_otp(phone_number, otp):
        pending_otps[phone_number] = otp
        otp_request_cooldowns[phone_number] = now
        return {"message": "OTP envoyé", "phone": phone_number}
    else:
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du SMS")

@router.post("/verify-otp")
def verify_otp(phone_number: str, code: str, request: Request, response: Response, db: Session = Depends(get_db)):
    if phone_number in pending_otps and pending_otps[phone_number] == code:
        pending_otps.pop(phone_number, None)
        user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
        
        if user:
            if not user.is_active:
                utils.clear_authenticated_session(request, db, response)
                raise HTTPException(status_code=403, detail="Ce numéro a été suspendu.")
            session_payload = utils.set_authenticated_session(response, user, db)
            return {"status": "success", "registered": True, **session_payload.model_dump()}
        else:
            return {"status": "success", "registered": False, "message": "Nouveau numéro."}
            
    raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")

@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    utils.clear_authenticated_session(request, db, response)

@router.get("/me", response_model=schemas.AuthSession)
def auth_me(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    return utils.build_auth_session_payload(user)

@router.post("/register", response_model=schemas.AuthSession)
def register_user(user: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    db_user = user_service.persist_user(user, db)
    return utils.set_authenticated_session(response, db_user, db)
