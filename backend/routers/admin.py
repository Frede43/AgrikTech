from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional, cast, Any
from datetime import datetime

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/admin",
    tags=["Administration"]
)

def check_admin_auth(request: Optional[Request], db: Session):
    if request is None:
        raise HTTPException(status_code=401, detail="Session context missing.")
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise.")
    
    if not utils.user_has_role(user, "admin"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")
    return user

@router.post("/users/{user_id}/verify-kyc")
def verify_kyc(
    user_id: int, 
    status: str, # 'verified' or 'rejected'
    notes: Optional[str] = None,
    request: Request = None, # type: ignore
    db: Session = Depends(get_db)
):
    """
    Valide ou rejette le dossier KYC d'un utilisateur.
    C'est le point de passage obligé pour autoriser les retraits financiers.
    """
    admin = check_admin_auth(request, db)
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if status not in ["verified", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Statut KYC invalide")
        
    user.kyc_status = str(status) # type: ignore
    user.kyc_notes = notes # type: ignore
    user.kyc_reviewed_at = utils.utcnow_naive() # type: ignore
    
    # Audit log
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action=f"KYC_{status.upper()}",
        entity_type="user",
        entity_id=user.id,
        detail=f"KYC {status} par l'admin. Notes: {notes}"
    ))
    
    db.commit()
    return {"message": f"Statut KYC mis à jour pour {user.name}: {status}"}

@router.post("/cooperatives/{coop_id}/verify")
def verify_cooperative(
    coop_id: int, 
    status: str, # 'verified' or 'unverified'
    notes: Optional[str] = None,
    request: Request = None, # type: ignore
    db: Session = Depends(get_db)
):
    """
    Approuve ou révoque la vérification d'une coopérative.
    Une coopérative vérifiée affiche un badge de confiance pour les acheteurs.
    """
    admin = check_admin_auth(request, db)
    
    coop = db.query(models.Cooperative).filter(models.Cooperative.id == coop_id).first()
    if not coop:
        raise HTTPException(status_code=404, detail="Coopérative non trouvée")
    
    is_verified = (status == "verified")
    coop.is_verified = cast(Any, is_verified)
    
    # Audit log
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action=f"COOP_{status.upper()}",
        entity_type="cooperative",
        entity_id=coop.id,
        detail=f"Coopérative {coop.name} marquée comme {status}. Notes: {notes}"
    ))
    
    db.commit()
    return {"message": f"Statut de vérification mis à jour pour {coop.name}", "is_verified": is_verified}

@router.get("/kyc/pending", response_model=List[schemas.User])
def get_pending_kyc(request: Request, db: Session = Depends(get_db)):
    """
    Liste les utilisateurs en attente de vérification KYC.
    """
    check_admin_auth(request, db)
    return db.query(models.User).filter(models.User.kyc_status == "pending").all()

@router.get("/withdrawals", response_model=List[schemas.AdminWithdrawalSummary])
@router.get("/withdrawals/", response_model=List[schemas.AdminWithdrawalSummary])
def list_withdrawals(request: Request, db: Session = Depends(get_db)):
    """
    Liste toutes les demandes de retrait pour traitement administratif.
    """
    check_admin_auth(request, db)
    
    withdrawals = db.query(models.WithdrawalRequest).order_by(models.WithdrawalRequest.created_at.desc()).all()
    results = []
    
    for w in withdrawals:
        # Build audit trail (mocked or from logs if they were persistent)
        # For now, let's just use the basic model data
        results.append(schemas.AdminWithdrawalSummary(
            id=f"WDR-{int(str(w.id)):05d}",
            dbId=int(str(w.id)),
            farmerId=int(str(w.user_id)),
            farmerName=str(w.user.name) if w.user else "Inconnu",
            farmerPhoneNumber=str(w.user.phone_number) if w.user else None,
            province=str(w.user.province) if w.user else None,
            amount=float(str(w.amount)),
            channel=str(w.channel),
            phoneNumber=str(w.phone_number),
            status=str(w.status),
            note=str(w.note) if w.note else None,
            createdAt=w.created_at.isoformat(),
            processedAt=w.processed_at.isoformat() if w.processed_at else None,
            processedByUserId=int(str(w.processed_by_user_id)) if w.processed_by_user_id else None,
            processedByName=str(w.processed_by.name) if w.processed_by else None,
            auditTrail=[] # Serait peuplé par admin_audit_logs filtrés
        ))
    return results

@router.post("/withdrawals/{withdrawal_id}/approve")
@router.post("/withdrawals/{withdrawal_id}/approve/")
def approve_withdrawal(
    withdrawal_id: int,
    payload: schemas.AdminActionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Approuve manuellement une demande de retrait.
    """
    admin = check_admin_auth(request, db)
    w = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == withdrawal_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Demande de retrait introuvable")
    
    if w.status != "pending":
        raise HTTPException(status_code=400, detail="Ce retrait a déjà été traité")
        
    w = cast(models.WithdrawalRequest, w)
    w.status = str("completed") # type: ignore
    w.processed_at = utils.utcnow_naive() # type: ignore
    w.processed_by_user_id = int(str(admin.id)) # type: ignore
    w.note = str(payload.note) if payload.note else None # type: ignore
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="WITHDRAWAL_APPROVED",
        entity_type="withdrawal",
        entity_id=w.id,
        detail=f"Retrait approuvé. Note: {payload.note}"
    ))
    
    db.commit()
    return {"message": "Retrait marqué comme terminé"}

@router.post("/withdrawals/{withdrawal_id}/reject")
@router.post("/withdrawals/{withdrawal_id}/reject/")
def reject_withdrawal(
    withdrawal_id: int,
    payload: schemas.AdminActionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Rejette une demande de retrait et recrédite l'ikigega de l'utilisateur.
    """
    admin = check_admin_auth(request, db)
    w = db.query(models.WithdrawalRequest).filter(models.WithdrawalRequest.id == withdrawal_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Demande de retrait introuvable")
        
    if w.status != "pending":
        raise HTTPException(status_code=400, detail="Ce retrait a déjà été traité")
        
    # Recréditer l'utilisateur
    if w.user:
        w.user.balance += w.amount
        db.add(models.TransactionLog(
            user_id=w.user_id,
            action="withdrawal_rejected",
            amount=w.amount
        ))
        
    w = cast(models.WithdrawalRequest, w)
    w.status = str("rejected") # type: ignore
    w.processed_at = utils.utcnow_naive() # type: ignore
    w.processed_by_user_id = int(str(admin.id)) # type: ignore
    w.note = str(payload.note) if payload.note else None # type: ignore
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="WITHDRAWAL_REJECTED",
        entity_type="withdrawal",
        entity_id=w.id,
        detail=f"Retrait rejeté. Note: {payload.note}"
    ))
    
    db.commit()
    return {"message": "Retrait rejeté et fonds restitués"}

@router.get("/testimonials", response_model=List[schemas.AdminTestimonialSummary])
@router.get("/testimonials/", response_model=List[schemas.AdminTestimonialSummary])
def list_admin_testimonials(request: Request, db: Session = Depends(get_db)):
    """
    Liste tous les témoignages (approuvés, rejetés, en attente) pour modération.
    """
    check_admin_auth(request, db)
    testimonials = db.query(models.Testimonial).order_by(models.Testimonial.created_at.desc()).all()
    results = []
    for t in testimonials:
        results.append(schemas.AdminTestimonialSummary(
            id=f"TESTI-{t.id:05d}",
            dbId=int(str(t.id)),
            userId=int(str(t.user_id)) if t.user_id else None,
            authorName=str(t.author_name),
            authorRoleFr=str(t.author_role_fr),
            authorRoleKi=str(t.author_role_ki),
            location=str(t.location) if t.location else None,
            quoteFr=str(t.quote_fr),
            quoteKi=str(t.quote_ki),
            rating=float(str(t.rating)),
            status=str(t.status),
            adminNote=str(t.admin_note) if t.admin_note else None,
            createdAt=t.created_at.isoformat() if t.created_at else str(""),
            reviewedAt=t.reviewed_at.isoformat() if t.reviewed_at else None,
            reviewedByUserId=int(str(t.reviewed_by_user_id)) if t.reviewed_by_user_id else None,
            reviewedByName=str(t.reviewed_by.name) if t.reviewed_by else None,
            auditTrail=[]
        ))
    return results

@router.post("/testimonials/{testimonial_id}/approve")
@router.post("/testimonials/{testimonial_id}/approve/")
def approve_testimonial(
    testimonial_id: int,
    payload: schemas.AdminActionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Approuve un témoignage pour qu'il soit visible sur le site.
    """
    admin = check_admin_auth(request, db)
    t = db.query(models.Testimonial).filter(models.Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Témoignage introuvable")
    
    t.status = str("approved") # type: ignore
    t.reviewed_at = utils.utcnow_naive() # type: ignore
    t.reviewed_by_user_id = int(str(admin.id)) # type: ignore
    t.admin_note = str(payload.note) if payload.note else None # type: ignore
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="TESTIMONIAL_APPROVED",
        entity_type="testimonial",
        entity_id=t.id,
        detail=f"Témoignage approuvé. Note: {payload.note}"
    ))
    
    db.commit()
    return {"message": "Témoignage approuvé"}

@router.post("/testimonials/{testimonial_id}/reject")
@router.post("/testimonials/{testimonial_id}/reject/")
def reject_testimonial(
    testimonial_id: int,
    payload: schemas.AdminActionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Refuse un témoignage.
    """
    admin = check_admin_auth(request, db)
    t = db.query(models.Testimonial).filter(models.Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Témoignage introuvable")
    
    t.status = str("rejected") # type: ignore
    t.reviewed_at = utils.utcnow_naive() # type: ignore
    t.reviewed_by_user_id = int(str(admin.id)) # type: ignore
    t.admin_note = str(payload.note) if payload.note else None # type: ignore
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="TESTIMONIAL_REJECTED",
        entity_type="testimonial",
        entity_id=t.id,
        detail=f"Témoignage refusé. Note: {payload.note}"
    ))
    
    db.commit()
    return {"message": "Témoignage refusé"}

@router.get("/settings", response_model=schemas.AdminSettingsResponse)
@router.get("/settings/", response_model=schemas.AdminSettingsResponse)
def get_admin_settings(request: Request, db: Session = Depends(get_db)):
    """
    Récupère les réglages globaux de la plateforme.
    """
    check_admin_auth(request, db)
    
    settings = db.query(models.SystemSettings).first()
    if not settings:
        settings = models.SystemSettings(
            commission_rate=0.05,
            maintenance_mode=False,
            support_phone=config.DEFAULT_SUPPORT_PHONE,
            support_whatsapp=config.DEFAULT_SUPPORT_WHATSAPP
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
    admins = db.query(models.User).filter(models.User.role.in_(config.ADMIN_ROLE_VALUES)).all()
    admin_list = []
    for a in admins:
        admin_list.append({
            "id": a.id,
            "name": a.name,
            "phone_number": a.phone_number,
            "province": a.province,
            "role": a.role
        })
        
    return {
        "commission_rate": float(str(settings.commission_rate)),
        "maintenance_mode": settings.maintenance_mode,
        "support_phone": settings.support_phone,
        "support_whatsapp": settings.support_whatsapp,
        "updated_at": settings.updated_at,
        "admins": admin_list
    }

@router.put("/settings", response_model=schemas.AdminSettingsResponse)
@router.put("/settings/", response_model=schemas.AdminSettingsResponse)
def update_admin_settings(payload: schemas.AdminSettingsUpdate, request: Request, db: Session = Depends(get_db)):
    """
    Met à jour les réglages de la plateforme.
    """
    admin = check_admin_auth(request, db)
    
    settings = db.query(models.SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings non initialisés")
        
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
        
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="SETTINGS_UPDATED",
        entity_type="settings",
        entity_id=cast(int, settings.id),
        detail=f"Mise à jour des paramètres: {update_data}"
    ))

    db.commit()
    db.refresh(settings)
    return get_admin_settings(request, db)

@router.post("/settings/admins")
@router.post("/settings/admins/")
def add_admin_agent(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Ajoute un nouvel administrateur à l'équipe.
    """
    admin = check_admin_auth(request, db)
    
    existing = db.query(models.User).filter(models.User.phone_number == payload.phone_number).first()
    if existing:
        if existing.role == "admin":
            raise HTTPException(status_code=400, detail="Ce numéro est déjà admin.")
        existing.role = str("admin") # type: ignore
        db.commit()
        return {"message": "Utilisateur promu en administrateur"}

    from backend.services.user_service import persist_user
    payload.role = "admin"
    new_admin = persist_user(payload, db, is_admin_context=True)
    
    db.add(models.AdminAuditLog(
        admin_user_id=admin.id,
        action="ADMIN_CREATED",
        entity_type="user",
        entity_id=new_admin.id,
        detail=f"Nouvel administrateur ajouté: {new_admin.name} ({new_admin.phone_number})"
    ))
    db.commit()
    
    return {"message": "Nouvel administrateur créé"}

@router.get("/finance-audits", response_model=schemas.AdminFinanceAuditResponse)
@router.get("/finance-audits/", response_model=schemas.AdminFinanceAuditResponse)
def list_finance_audits(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    q: Optional[str] = None,
    request: Request = None, # type: ignore
    db: Session = Depends(get_db)
):
    """
    Historique consolidé des événements financiers (retraits, litiges, audits).
    """
    check_admin_auth(request, db)
    
    query = db.query(models.AdminAuditLog)
    
    if entity_type and entity_type != "all":
        query = query.filter(models.AdminAuditLog.entity_type == entity_type)
    
    if action and action != "all":
        query = query.filter(models.AdminAuditLog.action == action)
        
    if q:
        query = query.filter(models.AdminAuditLog.detail.contains(q))
        
    audits = (
        query.order_by(models.AdminAuditLog.timestamp.desc())
        .limit(100)
        .all()
    )
    
    items = []
    for a in audits:
        tone = "neutral"
        if any(x in a.action for x in ["APPROVED", "VERIFIED", "COMPLETED", "SUCCESS"]):
            tone = "success"
        elif any(x in a.action for x in ["REJECTED", "CANCELLED", "FAILED", "DISPUTE"]):
            tone = "danger"
        elif any(x in a.action for x in ["PENDING", "REQUESTED", "SUBMITTED", "REVIEW"]):
            tone = "warning"
        elif any(x in a.action for x in ["CREATED", "ASSIGNED"]):
            tone = "info"

        items.append(schemas.AdminFinanceAuditItem(
            id=str(a.id),
            action=str(a.action),
            title=str(a.action).replace("_", " ").title(),
            detail=str(a.detail),
            actorName=str(a.admin_user.name) if a.admin_user else "Système",
            createdAt=a.timestamp.isoformat(),
            tone=tone,
            entityType=str(a.entity_type) or "system",
            entityId=int(str(a.entity_id)) if a.entity_id else None,
            reference=f"REF-{int(str(a.id)):04d}",
            priority="high" if tone == "danger" else "medium" if tone == "warning" else "low",
            status=None
        ))
        
    all_items = query.limit(500).all()
    
    return schemas.AdminFinanceAuditResponse(
        items=items,
        summary={
            "total": len(items),
            "withdrawalEvents": len([a for a in all_items if "WITHDRAWAL" in (a.action or "")]),
            "disputeEvents": len([a for a in all_items if "DISPUTE" in (a.action or "")]),
            "highPriorityEvents": len([a for a in all_items if any(x in (a.action or "") for x in ["REJECTED", "CANCELLED", "FAILED", "DISPUTE"])]),
            "pendingWithdrawalEvents": len([a for a in all_items if "WITHDRAWAL" in (a.action or "") and "REQUESTED" in (a.action or "")])
        }
    )

@router.get("/orders/logistics")
def admin_get_logistics_orders(
    status_filter: Optional[str] = None,
    request: Request = None, # type: ignore
    db: Session = Depends(get_db)
):
    """Liste toutes les commandes avec détail fermier, livreur et acheteur pour le tableau de dispatch admin."""
    check_admin_auth(request, db)

    from sqlalchemy.orm import joinedload
    query = db.query(models.Order).options(
        joinedload(models.Order.product).joinedload(models.Product.farmer),
        joinedload(models.Order.buyer),
        joinedload(models.Order.driver),
    )

    if status_filter:
        query = query.filter(models.Order.status == status_filter)

    results = []
    for o in query.order_by(models.Order.id.desc()).all():
        product = o.product
        farmer = product.farmer if product else None
        driver = o.driver
        buyer = o.buyer

        results.append({
            "id": int(str(o.id)),
            "orderId": utils.format_order_reference(int(str(o.id))),
            "status": str(o.status),
            "statusLabel": utils.serialize_order_status(str(o.status)),
            "placedAt": o.created_at.strftime("%d/%m/%Y %Hh%M") if o.created_at else "—",
            "product": {
                "name": str(product.name) if product else "—",
                "qty": float(str(o.quantity or 0)),
                "unit": str(product.unit) if product else "kg",
                "province": str(farmer.province) if farmer else "—",
            },
            "farmer": {
                "id": int(str(farmer.id)) if farmer else None,
                "name": str(farmer.name) if farmer else "—",
                "phone": str(farmer.phone_number) if farmer else "—",
                "province": str(farmer.province) if farmer else "—",
            },
            "buyer": {
                "id": int(str(buyer.id)) if buyer else None,
                "name": str(buyer.name) if buyer else "—",
                "phone": str(buyer.phone_number) if buyer else "—",
            },
            "driver": {
                "id": int(str(driver.id)) if driver else None,
                "name": str(driver.name) if driver else None,
                "phone": str(driver.phone_number) if driver else None,
            },
            "total": float(str(o.total_price or 0)),
            "pickup_qr": str(o.pickup_qr_token) or "—",
            "delivery_otp": str(o.delivery_otp) or "—",
        })

    return results

@router.put("/orders/{order_id}/assign-driver")
def admin_assign_driver(
    order_id: int,
    driver_id: Optional[int] = None,
    request: Request = None, # type: ignore
    db: Session = Depends(get_db)
):
    """Assigne ou ré-assigne (ou désassigne) un livreur à une commande."""
    admin = check_admin_auth(request, db)

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    old_driver_id = order.driver_id
    new_driver = None

    if driver_id is not None:
        new_driver = db.query(models.User).filter(
            models.User.id == driver_id,
            models.User.role == "logistique"
        ).first()
        if not new_driver:
            raise HTTPException(status_code=404, detail="Livreur introuvable ou rôle incorrect.")

    order.driver_id = int(str(driver_id)) if driver_id else None # type: ignore
    if driver_id is not None and order.status in ["PAID_ESCROW", "PENDING_PAYMENT"]:
        order.status = str("READY_FOR_PICKUP") # type: ignore

    # Audit log
    action_detail = (
        f"Admin reassigned order {utils.format_order_reference(int(str(order.id)))}: "
        f"driver {old_driver_id} → {driver_id} ({new_driver.name if new_driver else 'unassigned'})"
    )
    db.add(models.AdminAuditLog(
        admin_user_id=int(str(admin.id)),
        action=str("DRIVER_ASSIGNED" if driver_id else "DRIVER_UNASSIGNED"),
        entity_type="order",
        entity_id=int(str(order_id)),
        detail=str(action_detail),
    ))

    db.commit()
    return {
        "message": f"Livreur {'assigné' if driver_id else 'désassigné'} avec succès.",
        "order_id": order.id,
        "driver_id": driver_id,
        "driver_name": new_driver.name if new_driver else None,
    }


@router.get("/drivers")
def admin_get_drivers(request: Request, db: Session = Depends(get_db)):
    """Liste tous les livreurs disponibles pour le dispatch."""
    check_admin_auth(request, db)
    drivers = db.query(models.User).filter(models.User.role == "logistique", models.User.is_active == True).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "phone": d.phone_number,
            "province": d.province,
            "rating": d.rating,
        }
        for d in drivers
    ]
