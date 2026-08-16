from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, uuid

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db
from typing import cast
from decimal import Decimal

router = APIRouter(
    prefix="/users",
    tags=["Users & Profiles"]
)

KYC_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "kyc")
KYC_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "pdf"}
KYC_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 Mo

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
        
    from backend.services.user_service import persist_user
    db_user = persist_user(payload, db, is_admin_context=True)
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

    # Refuser la suppression si l'utilisateur possède des données liées :
    # les commandes, produits et transactions doivent rester traçables.
    has_linked_data = (
        db.query(models.Product.id).filter(models.Product.farmer_id == user_id).first() is not None
        or db.query(models.Order.id).filter(
            (models.Order.buyer_id == user_id)
            | (models.Order.farmer_id == user_id)
            | (models.Order.driver_id == user_id)
        ).first() is not None
        or db.query(models.TransactionLog.id).filter(models.TransactionLog.user_id == user_id).first() is not None
    )
    if has_linked_data:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer cet utilisateur car il possède déjà des données liées.",
        )

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


@router.post("/kyc/upload-document")
async def upload_kyc_document(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload la photo/scan d'une pièce d'identité pour le dossier KYC.
    Contrairement à /products/{id}/upload-image/, exige une session active :
    un document d'identité ne doit jamais pouvoir être déposé anonymement.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401)

    original_name = file.filename or ""
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if extension not in KYC_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non autorisé (jpg, jpeg, png ou pdf uniquement).")

    contents = await file.read()
    if len(contents) > KYC_MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (5 Mo maximum).")

    os.makedirs(KYC_UPLOAD_DIR, exist_ok=True)
    filename = f"kyc_{current_user.id}_{uuid.uuid4().hex[:8]}.{extension}"
    file_path = os.path.join(KYC_UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    return {"document_url": f"/static/uploads/kyc/{filename}"}

@router.post("/kyc/submit", response_model=schemas.User)
def submit_kyc(payload: schemas.UserKycSubmit, request: Request, db: Session = Depends(get_db)):
    """
    Soumet les documents KYC pour vérification.
    Passe automatiquement le statut à 'pending'.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401)

    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404)

    user.id_number = str(payload.id_number) # type: ignore
    user.id_document_url = str(payload.id_document_url) # type: ignore
    user.nationality = str(payload.nationality) # type: ignore
    user.nif_number = str(payload.nif_number) if payload.nif_number else None # type: ignore
    user.kyc_status = str("pending") # type: ignore
    user.kyc_notes = None # type: ignore
    user.kyc_reviewed_at = None # type: ignore

    # Log action
    db.add(models.AdminAuditLog(
        admin_user_id=None,
        action="KYC_SUBMITTED",
        entity_type="user",
        entity_id=user.id,
        detail=f"Utilisateur {user.name} a soumis ses documents KYC."
    ))

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
            "order_id": log.order_id,
            "type": "sale" if log.amount > 0 else "payout",
            "status": "paid",
            "buyer": order.buyer.name if order and order.buyer else "Système",
            "items": order.product.name if order and order.product else "Retrait Mobile Money",
            "gross": float(abs(cast(Decimal, log.amount))),
            "commission": 0, # Déjà déduit dans le net pour les logs
            "net": float(cast(Decimal, log.amount)),
            "order_reference": utils.format_order_reference(cast(int, order.id)) if order else None,
            "pickup_qr": order.pickup_qr_token if order else None
        })

    # 2. Si c'est un fermier, ajouter les commandes EN ATTENTE (pas encore de TransactionLog)
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if target_user and utils.normalize_role(cast(str, target_user.role)) == "fermier":
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
            if any(r.get("order_reference") == utils.format_order_reference(cast(int, o.id)) for r in results):
                continue
                
            total = float(cast(Decimal, o.total_price))
            comm = float(cast(Decimal, o.total_price)) * float(config.DEFAULT_COMMISSION_RATE)
            results.append({
                "id": f"ORD-{o.id:05d}",
                "date": o.created_at.isoformat(),
                "order_id": o.id,
                "type": "sale",
                "status": "pending",
                "buyer": o.buyer.name if o.buyer else "Acheteur",
                "items": o.product.name if o.product else "Produit",
                "gross": total,
                "commission": comm,
                "net": total - comm,
                "order_reference": utils.format_order_reference(cast(int, o.id)),
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
