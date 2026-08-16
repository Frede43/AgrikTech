"""
Bootstrap du tout premier compte administrateur.

Utile quand aucun accès shell n'est disponible (ex. Render plan gratuit,
qui ne fournit pas de terminal interactif). Protégé par un secret partagé
(ADMIN_BOOTSTRAP_SECRET) et se désactive automatiquement dès qu'un admin
existe déjà en base — même si le secret venait à fuiter, il ne permet pas
de créer un second admin.
"""
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

import backend.config as config
import backend.models as models
import backend.utils as utils
from backend.database import get_db
from backend.schemas import UserCreate, User as UserSchema

router = APIRouter(
    prefix="/bootstrap",
    tags=["Bootstrap"]
)


@router.post("/admin", response_model=UserSchema)
def bootstrap_admin(
    payload: UserCreate,
    x_bootstrap_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    if not config.ADMIN_BOOTSTRAP_SECRET or not hmac.compare_digest(
        x_bootstrap_secret, config.ADMIN_BOOTSTRAP_SECRET
    ):
        # 404 plutôt que 401/403 : ne révèle pas l'existence de l'endpoint.
        raise HTTPException(status_code=404)

    if db.query(models.User).filter(models.User.role == "admin").first():
        raise HTTPException(
            status_code=403,
            detail="Un administrateur existe déjà. Utilisez Paramètres Admin pour en ajouter un autre.",
        )

    existing = db.query(models.User).filter(models.User.phone_number == payload.phone_number).first()
    if existing:
        existing.role = "admin"
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    data = utils.sanitize_user_update_payload(payload.model_dump())
    data["role"] = "admin"
    db_user = models.User(**data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
