from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import Dict, Optional
from datetime import datetime, timedelta

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db
from backend.models import utcnow_naive
from backend.services.sms_service import sms_service
from backend.services import user_service

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/request-otp")
def request_otp(phone_number: str, db: Session = Depends(get_db)):
    now = utcnow_naive()
    existing = db.query(models.OtpCode).filter(models.OtpCode.phone_number == phone_number).first()

    # Rate limit persistant (1 envoi par numéro toutes les OTP_RESEND_COOLDOWN_SECONDS)
    if existing is not None:
        cooldown_ends = existing.last_sent_at + timedelta(seconds=config.OTP_RESEND_COOLDOWN_SECONDS)
        if now < cooldown_ends:
            wait_time = int((cooldown_ends - now).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Veuillez attendre {wait_time} secondes."
            )

    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user and not user.is_active:
        if existing is not None:
            db.delete(existing)
            db.commit()
        raise HTTPException(status_code=403, detail="Ce numéro a été suspendue. Contactez l'administrateur.")

    otp = sms_service.generate_otp()
    if not sms_service.send_otp(phone_number, otp):
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du SMS")

    if existing is None:
        existing = models.OtpCode(phone_number=phone_number)
        db.add(existing)
    existing.code = otp
    existing.expires_at = now + timedelta(seconds=config.OTP_TTL_SECONDS)
    existing.attempts = 0
    existing.last_sent_at = now
    db.commit()

    payload = {"message": "OTP envoyé", "phone": phone_number}
    # En mode simulateur (pas de vrai SMS envoyé), on expose le code pour le
    # développement et les tests e2e — jamais en production.
    if sms_service.is_simulated and not config.IS_PRODUCTION:
        payload["mock_otp"] = otp
    return payload

@router.post("/verify-otp")
def verify_otp(phone_number: str, code: str, request: Request, response: Response, db: Session = Depends(get_db)):
    now = utcnow_naive()
    entry = db.query(models.OtpCode).filter(models.OtpCode.phone_number == phone_number).first()

    if entry is None or now > entry.expires_at:
        if entry is not None:
            db.delete(entry)
            db.commit()
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")

    if entry.attempts >= config.OTP_MAX_ATTEMPTS:
        db.delete(entry)
        db.commit()
        raise HTTPException(status_code=400, detail="Trop de tentatives. Demandez un nouveau code.")

    if entry.code != code:
        entry.attempts = entry.attempts + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")

    db.delete(entry)
    db.commit()

    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user:
        if not user.is_active:
            utils.clear_authenticated_session(request, db, response)
            raise HTTPException(status_code=403, detail="Ce numéro a été suspendu.")
        session_payload = utils.set_authenticated_session(response, user, db)
        return {"status": "success", "registered": True, **session_payload.model_dump()}
    return {"status": "success", "registered": False, "message": "Nouveau numéro."}

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
