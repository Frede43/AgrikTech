"""
Endpoints d'amorçage pour les tests e2e (Playwright).

Ce router n'est monté que si E2E_TEST_MODE=true (jamais en production, voir
main.py et config.py). Il permet aux tests de créer des utilisateurs de
n'importe quel rôle et d'agir en leur nom, en rejouant les vrais endpoints
avec une session forgée — les réponses sont donc identiques à celles de l'API
réelle.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

import backend.config as config
import backend.models as models
import backend.schemas as schemas
import backend.utils as utils
from backend.database import get_db
from backend.routers import orders as orders_router
from backend.routers import products as products_router
from backend.routers import users as users_router

router = APIRouter(
    prefix="/testing",
    tags=["Testing (e2e uniquement)"]
)


class _ForgedRequest:
    """Objet minimal exposant .cookies, suffisant pour get_authenticated_user."""

    def __init__(self, cookies: dict):
        self.cookies = cookies


def _impersonate(db: Session, user: models.User) -> _ForgedRequest:
    """Crée une vraie session persistée pour `user` et retourne une requête forgée."""
    utils.set_authenticated_session(Response(), user, db)
    session = (
        db.query(models.PersistentSession)
        .filter(models.PersistentSession.user_id == user.id)
        .order_by(models.PersistentSession.expires_at.desc())
        .first()
    )
    assert session is not None
    return _ForgedRequest({config.SESSION_COOKIE_NAME: session.id})


def _get_user_or_404(db: Session, user_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return user


@router.post("/users", response_model=schemas.User)
@router.post("/users/", response_model=schemas.User)
def seed_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """Crée un utilisateur de n'importe quel rôle (y compris admin)."""
    if db.query(models.User).filter(models.User.phone_number == payload.phone_number).first():
        raise HTTPException(status_code=400, detail="Ce numéro est déjà enregistré.")
    normalized_role = utils.normalize_role(payload.role)
    if not normalized_role:
        raise HTTPException(status_code=400, detail="Rôle utilisateur invalide")
    data = utils.sanitize_user_update_payload(payload.model_dump())
    data["role"] = normalized_role
    db_user = models.User(**data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=List[schemas.User])
@router.get("/users/", response_model=List[schemas.User])
def seed_list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.id.desc()).all()


@router.get("/users/{user_id}", response_model=schemas.User)
def seed_get_user(user_id: int, db: Session = Depends(get_db)):
    return _get_user_or_404(db, user_id)


@router.get("/users/{user_id}/transactions", response_model=List[dict])
def seed_get_user_transactions(user_id: int, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    forged = _impersonate(db, user)
    return users_router.get_user_transactions(user_id, forged, db)  # type: ignore[arg-type]


@router.post("/products", response_model=schemas.Product)
@router.post("/products/", response_model=schemas.Product)
def seed_product(
    product: schemas.ProductCreate,
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    farmer = _get_user_or_404(db, farmer_id)
    forged = _impersonate(db, farmer)
    return products_router.create_product(product, forged, db)  # type: ignore[arg-type]


@router.post("/orders", response_model=schemas.Order)
@router.post("/orders/", response_model=schemas.Order)
def seed_order(
    payload: schemas.OrderCreate,
    buyer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    buyer = _get_user_or_404(db, buyer_id)
    # Convertir l'ancien format {product_id, quantity} vers items[].
    if not payload.items and payload.product_id is not None:
        payload.items = [
            schemas.OrderItemCreateSchema(
                product_id=payload.product_id,
                quantity=payload.quantity or 1,
            )
        ]
    forged = _impersonate(db, buyer)
    return orders_router.create_order(payload, forged, db)  # type: ignore[arg-type]


@router.get("/orders/{order_id}", response_model=dict)
def seed_get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    buyer = _get_user_or_404(db, int(str(order.buyer_id)))
    forged = _impersonate(db, buyer)
    return orders_router.get_order_detail(order_id, forged, db)  # type: ignore[arg-type]
