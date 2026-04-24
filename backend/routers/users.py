from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas, config, utils
from database import get_db

router = APIRouter(
    prefix="/users",
    tags=["Users & Profiles"]
)

@router.get("", response_model=List[schemas.User])
@router.get("/", response_model=List[schemas.User])
def list_users(request: Request, db: Session = Depends(get_db)):
    """
    Liste tous les utilisateurs. Réservé aux administrateurs.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or not utils.user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
    return db.query(models.User).order_by(models.User.id.desc()).all()

@router.post("", response_model=schemas.User)
@router.post("/", response_model=schemas.User)
def admin_create_user(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Crée un nouvel utilisateur. Réservé aux administrateurs.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or not utils.user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
        
    from services.user_service import persist_user
    db_user = persist_user(payload, db)
    return db_user

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Supprime un utilisateur. Réservé aux administrateurs.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or not utils.user_has_role(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    db.delete(user)
    db.commit()

@router.get("/{user_id}", response_model=schemas.User)
def get_user_profile(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère les informations publiques et privées du profil utilisateur.
    Vérifie que l'utilisateur demande son propre profil ou est admin.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or (current_user.id != user_id and not utils.user_has_role(current_user, "admin")):
        raise HTTPException(status_code=403, detail="Accès non autorisé au profil.")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return user

@router.put("/{user_id}", response_model=schemas.User)
def update_user_profile(user_id: int, payload: schemas.UserUpdate, request: Request, db: Session = Depends(get_db)):
    """
    Met à jour les informations du profil (Localisation, KYC, etc.).
    Utilise utils.sanitize_user_update_payload pour la sécurité.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or (current_user.id != user_id and not utils.user_has_role(current_user, "admin")):
        raise HTTPException(status_code=403, detail="Accès non autorisé pour la modification.")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    update_data = payload.model_dump(exclude_unset=True)
    # Sanitize inputs (security)
    update_data = utils.sanitize_user_update_payload(update_data)
    
    # Enforce rules: Non-admins cannot change their own balance or active status
    if not utils.user_has_role(current_user, "admin"):
        update_data.pop("balance", None)
        update_data.pop("is_active", None)
        update_data.pop("role", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}/transactions", response_model=List[dict])
def get_user_transactions(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Historique des transactions financières pour l'utilisateur.
    Inclut les logs de transactions et les commandes en attente pour les fermiers.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or (current_user.id != user_id and not utils.user_has_role(current_user, "admin")):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
        
    # 1. Récupérer les logs réels (déjà payés ou retraits)
    logs = (
        db.query(models.TransactionLog)
        .filter(models.TransactionLog.user_id == user_id)
        .order_by(models.TransactionLog.timestamp.desc())
        .all()
    )
    
    results = []
    
    # Transformer les logs en format frontend
    for log in logs:
        order = db.query(models.Order).filter(models.Order.id == log.order_id).first() if log.order_id else None
        results.append({
            "id": f"TXN-{log.id:05d}",
            "date": log.timestamp.isoformat(),
            "type": "sale" if log.amount > 0 else "payout",
            "status": "paid",
            "buyer": order.buyer.name if order and order.buyer else "Système",
            "items": order.product.name if order and order.product else "Retrait Mobile Money",
            "gross": float(abs(log.amount)),
            "commission": 0, # Déjà déduit dans le net pour les logs
            "net": float(log.amount),
            "order_reference": utils.format_order_reference(order.id) if order else None,
            "pickup_qr": order.pickup_qr_token if order else None
        })

    # 2. Si c'est un fermier, ajouter les commandes EN ATTENTE (pas encore de TransactionLog)
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if target_user and utils.normalize_role(target_user.role) == "fermier":
        pending_orders = (
            db.query(models.Order)
            .filter(
                models.Order.farmer_id == user_id,
                models.Order.status.in_(["PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP", "PICKED_UP"])
            )
            .all()
        )
        
        for o in pending_orders:
            # Vérifier si on n'a pas déjà un log pour cette commande (sécurité)
            if any(r.get("order_reference") == utils.format_order_reference(o.id) for r in results):
                continue
                
            total = float(o.total_price)
            comm = float(o.total_price) * config.DEFAULT_COMMISSION_RATE
            results.append({
                "id": f"ORD-{o.id:05d}",
                "date": o.created_at.isoformat(),
                "type": "sale",
                "status": "pending",
                "buyer": o.buyer.name if o.buyer else "Acheteur",
                "items": o.product.name if o.product else "Produit",
                "gross": total,
                "commission": comm,
                "net": total - comm,
                "order_reference": utils.format_order_reference(o.id),
                "pickup_qr": o.pickup_qr_token
            })

    # Trier par date décroissante
    results.sort(key=lambda x: x["date"], reverse=True)
    return results

@router.get("/{user_id}/notifications", response_model=List[dict])
def get_user_notifications(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère les notifications pour un utilisateur spécifique.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or (current_user.id != user_id and not utils.user_has_role(current_user, "admin")):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
    return [] # Mock for now
