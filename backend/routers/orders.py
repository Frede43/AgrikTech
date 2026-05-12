from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, cast
from decimal import Decimal
import uuid, random
from datetime import datetime

import backend.models as models
import backend.schemas as schemas
import backend.config as config
import backend.utils as utils
from backend.database import get_db
from backend.services.payment_service import payment_service
from backend.services.order_service import order_service

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.post("/", response_model=schemas.Order)
def create_order(order: schemas.OrderCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
        
    product = db.query(models.Product).filter(models.Product.id == order.product_id).first()
    if not product or cast(float, product.quantity_kg) < order.quantity:
        raise HTTPException(status_code=400, detail="Stock insuffisant.")
        
    total_price = Decimal(str(product.price_per_kg)) * Decimal(str(order.quantity))
    vat_rate = Decimal(str(product.vat_rate)) if product.vat_rate is not None else Decimal("0.18")
    is_taxable_val = product.is_taxable
    subtotal = total_price / (Decimal("1") + vat_rate) if is_taxable_val else total_price
    vat_amount = total_price - subtotal
    
    db_order = models.Order(
        buyer_id=user.id,
        farmer_id=product.farmer_id,
        product_id=product.id,
        quantity=order.quantity,
        total_price=total_price,
        vat_amount=vat_amount,
        subtotal_price=subtotal,
        invoice_number=f"FAC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        status="PENDING_PAYMENT",
        pickup_qr_token=f"QR-{uuid.uuid4().hex[:6].upper()}",
        delivery_otp=str(random.randint(1000, 9999))
    )
    db.add(db_order)
    db.flush()
    payment_service.process_order_payment_to_escrow(db, db_order)
    product.quantity_kg = cast(float, product.quantity_kg) - order.quantity # type: ignore
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/logistics")
def get_logistics_orders(
    driver_id: Optional[int] = Query(None),
    mode: Optional[str] = Query(None),  # "pool" | "mine"
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    mode="pool"  → commandes confirmées sans livreur (disponibles pour tous)
    mode="mine"  → commandes assignées à driver_id
    Sans mode    → retro-compat: toutes les commandes (usage admin uniquement)
    """
    query = db.query(models.Order).options(
        joinedload(models.Order.product).joinedload(models.Product.farmer),
        joinedload(models.Order.driver),
    )

    if mode == "pool":
        # Commandes payées/confirmées mais sans livreur assigné
        query = query.filter(
            models.Order.driver_id.is_(None),
            models.Order.status.in_(["PAID_ESCROW", "PENDING_PAYMENT", "CONFIRMED", "READY_FOR_PICKUP"])
        )
    elif mode == "mine" and driver_id:
        # Commandes assignées à ce livreur spécifique
        query = query.filter(models.Order.driver_id == driver_id)
    elif status:
        query = query.filter(models.Order.status.in_(order_service.get_query_statuses(status)))

    results = []
    for o in query.order_by(models.Order.id.desc()).all():
        product = o.product
        farmer = product.farmer if product else None
        driver = o.driver
        
        status_str = str(o.status) if o.status is not None else ""

        items_label = f"{float(str(o.quantity)) if o.quantity is not None else 0.0} {str(product.unit) if product else 'kg'} — {str(product.name) if product else '?'}"
        farmer_name = str(product.farmer.name) if (product and product.farmer and product.farmer.name) else "Fermier AgriConnect"
        farmer_province = str(product.farmer.province) if (product and product.farmer and product.farmer.province) else "—"

        results.append({
            "id": o.id,
            "orderId": utils.format_order_reference(cast(int, o.id)),
            "status": utils.serialize_order_status(cast(str, o.status)),
            "farmer": farmer_name,
            "address": farmer_province,
            "items": items_label,
            "distance": "—",
            "pickupTime": o.created_at.strftime("%Hh%M") if o.created_at is not None else "—",
            "priority": "high" if o.status in ["CONFIRMED", "READY_FOR_PICKUP"] else "medium",
            "pickup_qr": o.pickup_qr_token or "—",
            "delivery_otp": o.delivery_otp or "—",
            "driver_id": o.driver_id,
            "driver_name": driver.name if driver else None,
        })
    return results


@router.get("/buyer/{buyer_id}", response_model=List[dict])
def get_buyer_orders(buyer_id: int, db: Session = Depends(get_db)):
    orders = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.product).joinedload(models.Product.farmer),
            joinedload(models.Order.driver),
        )
        .filter(models.Order.buyer_id == buyer_id)
        .order_by(models.Order.id.desc())
        .all()
    )

    results = []
    for o in orders:
        product = o.product
        driver = o.driver
        
        status_str: str = str(o.status) if o.status is not None else ""
        
        items = []
        if product:
            items.append({
                "name": product.name,
                "qty": cast(float, o.quantity) if o.quantity is not None else 0.0,
                "unit": product.unit or "kg",
                "price": float(cast(Decimal, product.price_per_kg)) if product and product.price_per_kg is not None else 0.0,
                "lineTotal": float(cast(Decimal, o.total_price)) if o.total_price is not None else 0.0,
                "image_url": product.image_url,
            })

        farmer_name = product.farmer.name if (product and product.farmer) else "Fermier AgriConnect"
        driver_info = {"name": driver.name, "phone": driver.phone_number} if driver else None

        results.append({
            "id": o.id,
            "orderId": utils.format_order_reference(int(str(o.id))),
            "status": utils.serialize_order_status(str(o.status)),
            "placedAt": o.created_at.strftime("%d/%m/%Y %Hh%M") if o.created_at is not None else "—",
            "farmer": farmer_name,
            "driver": driver_info,
            "items": items,
            "total": float(cast(Decimal, o.total_price)) if o.total_price is not None else 0.0,
            "totalWeight": f"{cast(float, o.quantity) if o.quantity is not None else 0.0} kg",
            "estimatedDelivery": "Sous 24h",
            "pickup_qr": o.pickup_qr_token or "—",
            "delivery_otp": o.delivery_otp or "—",
        })

    return results


@router.get("/{order_id}", response_model=dict)
def get_order_detail(order_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère les détails complets d'une commande pour la logistique ou le suivi.
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401)

    order = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.product).joinedload(models.Product.farmer),
            joinedload(models.Order.buyer),
            joinedload(models.Order.driver),
        )
        .filter(models.Order.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    # Vérification des permissions : l'acheteur, le fermier, le livreur assigné ou l'admin
    is_admin = utils.user_has_role(user, "admin")
    is_buyer = cast(int, order.buyer_id) == user.id
    is_farmer = cast(int, order.farmer_id) == user.id
    is_driver = (cast(int, order.driver_id) == user.id) if order.driver_id is not None else utils.user_has_role(user, "logistique")

    if not (is_admin or is_buyer or is_farmer or is_driver):
        raise HTTPException(status_code=403, detail="Accès non autorisé à cette commande.")

    product = order.product
    farmer = product.farmer if product else None
    buyer = order.buyer

    # Calcul des distances et durées (simulé ou réel via utils)
    dist_km = utils.calculate_distance_km(farmer, buyer)
    
    return {
        "id": cast(int, order.id),
        "orderId": utils.format_order_reference(cast(int, order.id)),
        "status": cast(str, order.status).lower(), # Le frontend attend du minuscule pour statusLabels
        "farmer": {
            "name": str(farmer.name) if farmer and farmer.name else "Fermier Inconnu",
            "address": str(farmer.province) if farmer and farmer.province else "Burundi",
            "phone": str(farmer.phone_number) if farmer and farmer.phone_number else "",
            "coordinates": f"{farmer.latitude},{farmer.longitude}" if farmer and farmer.latitude is not None else "0,0"
        },
        "buyer": {
            "name": str(buyer.name) if buyer and buyer.name else "Acheteur Inconnu",
            "address": str(buyer.address or buyer.province or "Burundi"),
            "phone": str(buyer.phone_number) if buyer and buyer.phone_number else "",
            "coordinates": f"{buyer.latitude},{buyer.longitude}" if buyer and buyer.latitude is not None else "0,0"
        },
        "items": [
            {
                "name": cast(str, product.name) if product and product.name else "Produit",
                "qty": cast(float, order.quantity) if order.quantity is not None else 0.0,
                "unit": cast(str, product.unit) if product and product.unit else "kg"
            }
        ],
        "totalWeight": f"{cast(float, order.quantity) if order.quantity is not None else 0.0} {cast(str, product.unit) if product and product.unit else 'kg'}",
        "distance": utils.format_distance_label(dist_km),
        "estimatedDuration": utils.format_duration_label(dist_km),
        "instructions": "Fragile - Manipuler avec soin" if "tomate" in (cast(str, product.name).lower() if product and product.name else "") else "Livraison standard",
        "pickup_qr": cast(str, order.pickup_qr_token) if order.pickup_qr_token else "—",
        "delivery_otp": cast(str, order.delivery_otp) if order.delivery_otp else "—"
    }



@router.post("/{order_id}/accept")
def accept_order(order_id: int, driver_id: int, request: Request, db: Session = Depends(get_db)):
    """Un livreur prend en charge une commande sans livreur assigné."""
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "logistique"):
        raise HTTPException(status_code=403, detail="Accès réservé aux livreurs.")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    if order.driver_id is not None:
        raise HTTPException(status_code=409, detail="Cette commande a déjà été prise en charge par un autre livreur.")
    if order.status not in ["PAID_ESCROW", "PENDING_PAYMENT", "CONFIRMED", "READY_FOR_PICKUP"]:
        raise HTTPException(status_code=400, detail="Cette commande n'est pas disponible à la collecte.")

    order.driver_id = user.id # type: ignore
    order.status = "READY_FOR_PICKUP" # type: ignore
    db.commit()
    return {"message": "Commande acceptée. Bonne livraison !", "order_id": order.id}


@router.post("/{order_id}/pickup")
def pickup_order(order_id: int, qr_token: str, driver_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or not order_service.is_available_for_pickup(str(order.status)):
        raise HTTPException(status_code=400, detail="Commande non disponible pour collecte.")
    if order.pickup_qr_token != qr_token:
        raise HTTPException(status_code=403, detail="QR Code invalide.")
    # Vérifier que c'est bien le livreur assigné
    if order.driver_id is not None and int(str(order.driver_id)) != driver_id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le livreur assigné à cette commande.")

    order.status = "PICKED_UP" # type: ignore
    order.driver_id = int(driver_id) # type: ignore
    db.commit()
    return {"message": "Collecté."}


@router.post("/{order_id}/deliver")
def deliver_order(order_id: int, otp_code: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or not order_service.is_in_delivery_phase(str(order.status)):
        raise HTTPException(status_code=400, detail="État de livraison invalide.")
    if order.delivery_otp != otp_code:
        raise HTTPException(status_code=403, detail="OTP invalide.")

    order.status = "COMPLETED" # type: ignore
    payment_service.release_funds_to_farmer(db, order)
    db.commit()
    return {"message": "Livré."}
