from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import Dict, Optional
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
from sqlalchemy.exc import IntegrityError

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db
from backend.models import utcnow_naive
from backend.services.sms_service import sms_service
from backend.services import user_service

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def _otp_digest(phone_number: str, code: str) -> str:
    return hmac.new(
        config.SECRET_KEY.encode("utf-8"),
        f"{phone_number}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

@router.post("/request-otp")
def request_otp(payload: schemas.OtpRequest, db: Session = Depends(get_db)):
    phone_number = payload.phone_number
    now = utcnow_naive()
    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user and not user.is_active:
        raise HTTPException(status_code=403, detail="Ce numéro a été suspendue. Contactez l'administrateur.")

    otp = sms_service.generate_otp()
    otp_digest = _otp_digest(phone_number, otp)
    existing = (
        db.query(models.OtpCode)
        .filter(models.OtpCode.phone_number == phone_number)
        .populate_existing()
        .with_for_update()
        .first()
    )

    if existing is not None:
        # Verrouiller et réserver le délai avant d'appeler le fournisseur SMS :
        # deux requêtes simultanées ne peuvent pas toutes deux passer le délai.
        cooldown_ends = existing.last_sent_at + timedelta(seconds=config.OTP_RESEND_COOLDOWN_SECONDS)
        if now < cooldown_ends:
            wait_time = int((cooldown_ends - now).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Veuillez attendre {wait_time} secondes."
            )
        existing.code = otp_digest
        existing.expires_at = now + timedelta(seconds=config.OTP_TTL_SECONDS)
        existing.attempts = 0
        existing.last_sent_at = now
        db.commit()
    else:
        # L'index unique sur phone_number arbitre deux premières demandes en
        # parallèle. Le perdant ne contacte pas le fournisseur SMS.
        db.add(models.OtpCode(
            phone_number=phone_number,
            code=otp_digest,
            expires_at=now + timedelta(seconds=config.OTP_TTL_SECONDS),
            attempts=0,
            last_sent_at=now,
        ))
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=429,
                detail="Une demande de code vient d'être envoyée. Réessayez après le délai indiqué.",
            ) from exc

    if not sms_service.send_otp(phone_number, otp):
        # Invalider le code réservé si l'envoi échoue, sans écraser un code
        # plus récent demandé après expiration du délai.
        db.query(models.OtpCode).filter(
            models.OtpCode.phone_number == phone_number,
            models.OtpCode.code == otp_digest,
        ).update({models.OtpCode.expires_at: now}, synchronize_session=False)
        db.commit()
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du SMS")

    payload = {"message": "OTP envoyé", "phone": phone_number}
    # En mode simulateur (pas de vrai SMS envoyé), on expose le code pour le
    # développement et les tests e2e — jamais en production.
    if sms_service.is_simulated and not config.IS_PRODUCTION:
        payload["mock_otp"] = otp
    return payload

@router.post("/verify-otp")
def verify_otp(payload: schemas.OtpVerifyRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    phone_number = payload.phone_number
    code = payload.code
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")
    now = utcnow_naive()
    entry = (
        db.query(models.OtpCode)
        .filter(models.OtpCode.phone_number == phone_number)
        .with_for_update()
        .first()
    )

    if entry is None or now > entry.expires_at:
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")

    if entry.attempts >= config.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Trop de tentatives. Demandez un nouveau code.")

    if not hmac.compare_digest(entry.code, _otp_digest(phone_number, code)):
        updated = db.query(models.OtpCode).filter(
            models.OtpCode.id == entry.id,
            models.OtpCode.attempts < config.OTP_MAX_ATTEMPTS,
        ).update(
            {models.OtpCode.attempts: models.OtpCode.attempts + 1},
            synchronize_session=False,
        )
        db.commit()
        if not updated:
            raise HTTPException(status_code=400, detail="Trop de tentatives. Demandez un nouveau code.")
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")

    # Invalider le code sans supprimer last_sent_at : conserver cette ligne
    # garde le cooldown même après une connexion ou une inscription réussie.
    entry.code = ""
    entry.expires_at = now
    entry.attempts = 0

    user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if user:
        db.query(models.RegistrationChallenge).filter(
            models.RegistrationChallenge.phone_number == phone_number
        ).delete(synchronize_session=False)
        db.commit()
        if not user.is_active:
            utils.clear_authenticated_session(request, db, response)
            raise HTTPException(status_code=403, detail="Ce numéro a été suspendu.")
        session_payload = utils.set_authenticated_session(response, user, db)
        return {"status": "success", "registered": True, **session_payload.model_dump()}

    registration_token = secrets.token_urlsafe(32)
    db.query(models.RegistrationChallenge).filter(
        models.RegistrationChallenge.phone_number == phone_number
    ).delete(synchronize_session=False)
    db.add(models.RegistrationChallenge(
        phone_number=phone_number,
        token_hash=hashlib.sha256(registration_token.encode("utf-8")).hexdigest(),
        expires_at=now + timedelta(minutes=10),
    ))
    db.commit()
    return {
        "status": "success",
        "registered": False,
        "registration_token": registration_token,
        "message": "Nouveau numéro.",
    }

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
def register_user(payload: schemas.UserRegistrationRequest, response: Response, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(payload.registration_token.encode("utf-8")).hexdigest()
    challenge = (
        db.query(models.RegistrationChallenge)
        .filter(
            models.RegistrationChallenge.phone_number == payload.phone_number,
            models.RegistrationChallenge.token_hash == token_hash,
        )
        .with_for_update()
        .first()
    )
    if not challenge or challenge.expires_at <= utcnow_naive():
        raise HTTPException(status_code=403, detail="Vérifiez votre numéro par SMS avant de créer un compte.")

    # La suppression du défi et l'insertion du compte sont validées par le même
    # commit dans persist_user : le jeton est lié au téléphone et consommé une fois.
    db.delete(challenge)
    user = schemas.UserCreate(
        **payload.model_dump(exclude={"registration_token"}),
        kyc_status="pending",
        id_document_url=None,
    )
    db_user = user_service.persist_user(user, db)
    return utils.set_authenticated_session(response, db_user, db)
