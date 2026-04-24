from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import models, config, utils, schemas
from database import get_db

router = APIRouter(
    prefix="/platform",
    tags=["Platform Config"]
)

@router.get("/settings")
def get_public_platform_settings(db: Session = Depends(get_db)):
    """
    Retourne les paramètres publics de la plateforme (commission, etc.)
    Accessible sans authentification admin.
    """
    settings = db.query(models.SystemSettings).first()
    # On renvoie les valeurs réelles depuis la BD, ou valeurs par défaut du config
    rate = float(settings.commission_rate) if settings else 0.05
    return {
        "commission_rate": rate,
        "maintenance_mode": settings.maintenance_mode if settings else False,
        "support_phone": settings.support_phone if settings else config.DEFAULT_SUPPORT_PHONE,
        "support_whatsapp": settings.support_whatsapp if settings else config.DEFAULT_SUPPORT_WHATSAPP
    }
