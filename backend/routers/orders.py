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
from backend.services.mobile_money_service import mobile_money_service, STATUS_SUCCESS, STATUS_FAILED

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.post("/", response_model=schemas.Order)
def create_order(order_payload: schemas.OrderCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
        
    if not order_payload.items:
        raise HTTPException(status_code=400, detail="La commande est vide.")

    # 1. Valider les produits et s'assurer qu'ils appartiennent au même vendeur (Fermier ou Coopérative)
    items_to_create = []
    farmer_id = None
    cooperative_id = None
    total_ttc = Decimal("0")
    total_vat = Decimal("0")
    total_ht = Decimal("0")
    
    for item in order_payload.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.is_active == True
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Produit {item.product_id} non trouvé.")
        
        if cast(float, product.quantity_kg) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {product.name}.")
        
        # Déterminer l'entité vendeuse (Priorité à la Coopérative si présente)
        if farmer_id is None and cooperative_id is None:
            farmer_id = product.farmer_id
            cooperative_id = product.cooperative_id
        else:
            if product.cooperative_id:
                if cooperative_id != product.cooperative_id:
                    raise HTTPException(status_code=400, detail="Tous les produits d'une commande collective doivent provenir de la même coopérative.")
            else:
                if farmer_id != product.farmer_id:
                    raise HTTPException(status_code=400, detail="Tous les produits d'une commande individuelle doivent provenir du même fermier.")
            
        # Calculs financiers pour cet item
        price_ttc = Decimal(str(product.price_per_kg)) * Decimal(str(item.quantity))
        vat_rate = Decimal(str(product.vat_rate)) if product.vat_rate is not None else Decimal("0.18")
        is_taxable_val = product.is_taxable
        
        item_ht = price_ttc / (Decimal("1") + vat_rate) if is_taxable_val else price_ttc
        item_vat = price_ttc - item_ht
        
        total_ttc += price_ttc
        total_vat += item_vat
        total_ht += item_ht
        
        items_to_create.append({
            "product": product,
            "quantity": item.quantity,
            "price_at_order": product.price_per_kg
        })

    # 1bis. Frais de livraison — versé en intégralité au livreur à la
    # livraison (payment_service.release_delivery_fee_to_driver), ajouté au
    # total facturé mais PAS à subtotal_price/vat_amount (produit-uniquement,
    # base de la commission fermier — voir payment_service.release_funds_to_farmer).
    seller = db.query(models.User).filter(models.User.id == farmer_id).first() if farmer_id else None
    delivery_fee = utils.compute_delivery_fee(user, seller)
    total_ttc += delivery_fee

    # 2. Créer l'entité Order
    db_order = models.Order(
        buyer_id=user.id,
        farmer_id=farmer_id,
        cooperative_id=cooperative_id,
        total_price=total_ttc,
        vat_amount=total_vat,
        subtotal_price=total_ht,
        delivery_fee=delivery_fee,
        invoice_number=f"FAC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        status="PENDING_PAYMENT",
        pickup_qr_token=f"QR-{uuid.uuid4().hex[:6].upper()}",
        delivery_otp=str(random.randint(1000, 9999))
    )
    db.add(db_order)
    db.flush()
    
    # 3. Créer les OrderItems et déduire le stock
    for it in items_to_create:
        order_item = models.OrderItem(
            order_id=db_order.id,
            product_id=it["product"].id,
            quantity=it["quantity"],
            price_at_order=it["price_at_order"]
        )
        db.add(order_item)

        # Déduction stock
        it["product"].quantity_kg = cast(float, it["product"].quantity_kg) - it["quantity"]

    # Champs hérités mono-produit : utilisés par l'historique des transactions
    # et par la restauration de stock lors d'une annulation.
    if len(items_to_create) == 1:
        db_order.product_id = items_to_create[0]["product"].id
        db_order.quantity = items_to_create[0]["quantity"]

    # 4. Encaisser via mobile money. En mode "mock" (défaut) le paiement est
    # immédiat ; en mode "api" la commande reste PENDING_PAYMENT jusqu'à la
    # confirmation du webhook /payments/webhook.
    collection = mobile_money_service.initiate_collection(
        cast(Optional[str], user.phone_number),
        total_ttc,
        cast(str, db_order.invoice_number),
    )
    if collection["status"] == STATUS_FAILED:
        db.rollback()
        raise HTTPException(status_code=502, detail="Le paiement mobile money a échoué. Réessayez.")
    if collection["status"] == STATUS_SUCCESS:
        payment_service.process_order_payment_to_escrow(db, db_order)
    db.commit()
    
    # Recharger avec les relations pour le response_model
    order_final = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.items).joinedload(models.OrderItem.product),
            joinedload(models.Order.farmer),
            joinedload(models.Order.driver),
        )
        .filter(models.Order.id == db_order.id)
        .first()
    )
    return order_final

@router.get("/logistics")
def get_logistics_orders(
    request: Request,
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
    user = utils.get_authenticated_user(request, db)
    # distance logic depends on 'user' being defined
    query = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.product),
        joinedload(models.Order.farmer),
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
        farmer = o.farmer
        driver = o.driver
        
        status_str = str(o.status) if o.status is not None else ""
        
        total_weight = sum(item.quantity or 0.0 for item in o.items)
        items_summary = ", ".join([f"{item.quantity} {item.product.unit if item.product else 'kg'} {item.product.name if item.product else 'produit'}" for item in o.items])

        farmer_name = farmer.name if farmer else "Fermier AgriConnect"
        farmer_province = farmer.province if farmer else "—"

        results.append({
            "id": o.id,
            "orderId": utils.format_order_reference(cast(int, o.id)),
            "status": status_str,
            "items_label": items_summary,
            "farmer": farmer_name,
            "address": farmer_province,
            "items": [
                {
                    "name": item.product.name if item.product else "Produit",
                    "qty": item.quantity,
                    "unit": item.product.unit if item.product else "kg"
                } for item in o.items
            ],
            "distance": utils.format_distance_label(utils.calculate_road_distance_km_sync(farmer, user) or utils.calculate_distance_km(farmer, user)) if user else "—",
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
            joinedload(models.Order.items).joinedload(models.OrderItem.product),
            joinedload(models.Order.farmer),
            joinedload(models.Order.driver),
        )
        .filter(models.Order.buyer_id == buyer_id)
        .order_by(models.Order.id.desc())
        .all()
    )

    results = []
    for o in orders:
        driver = o.driver
        farmer = o.farmer
        
        status_str: str = str(o.status) if o.status is not None else ""
        
        items_data = []
        total_weight = 0.0
        for item in o.items:
            product = item.product
            items_data.append({
                "name": item.name, # Utilise la propriété @property du modèle
                "qty": item.quantity,
                "unit": item.unit, # Utilise la propriété @property du modèle
                "price": float(cast(Decimal, item.price_at_order)),
                "lineTotal": float(cast(Decimal, item.lineTotal)), # Utilise la propriété @property du modèle
                "image_url": item.image_url,
            })
            total_weight += (item.quantity or 0.0)

        farmer_name = farmer.name if farmer else "Fermier AgriConnect"
        driver_info = {"name": driver.name, "phone": driver.phone_number} if driver else None

        results.append({
            "id": o.id,
            "orderId": utils.format_order_reference(int(str(o.id))),
            "status": utils.serialize_order_status(str(o.status)),
            "placedAt": o.created_at.strftime("%d/%m/%Y %Hh%M") if o.created_at is not None else "—",
            "farmer": farmer_name,
            "driver": driver_info,
            "items": items_data,
            "total": float(cast(Decimal, o.total_price)) if o.total_price is not None else 0.0,
            "totalWeight": f"{total_weight} kg",
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
            joinedload(models.Order.items).joinedload(models.OrderItem.product),
            joinedload(models.Order.buyer),
            joinedload(models.Order.driver),
            joinedload(models.Order.farmer),
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

    farmer = order.farmer
    buyer = order.buyer

    # Calcul des distances et durées (Réel via ORS ou fallback Haversine)
    road_dist = utils.calculate_road_distance_km_sync(farmer, buyer)
    dist_km = road_dist if road_dist is not None else utils.calculate_distance_km(farmer, buyer)
    
    items_data = [
        {
            "name": item.name,
            "qty": item.quantity,
            "unit": item.unit,
            "price": float(cast(Decimal, item.price_at_order)),
            "lineTotal": float(cast(Decimal, item.lineTotal)),
            "image_url": item.image_url,
        } for item in order.items
    ]

    return {
        "id": cast(int, order.id),
        "orderId": utils.format_order_reference(cast(int, order.id)),
        "status": cast(str, order.status).lower(),
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
        "items": items_data,
        "totalWeight": f"{sum(it['qty'] for it in items_data)} kg",
        "distance": utils.format_distance_label(dist_km),
        "estimatedDuration": utils.format_duration_label(dist_km),
        "instructions": "Fragile - Manipuler avec soin" if any("tomate" in it['name'].lower() for it in items_data) else "Livraison standard",
        "total": float(cast(Decimal, order.total_price)),
        "placedAt": order.created_at.strftime("%d/%m/%Y à %Hh%M") if order.created_at else "—",
        "pickup_qr": order.pickup_qr_token or "—",
        "delivery_otp": order.delivery_otp or "—"
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
        raise HTTPException(status_code=403, detail="Code OTP de livraison invalide.")

    order.status = "COMPLETED" # type: ignore
    payment_service.release_funds_to_farmer(db, order)
    payment_service.release_delivery_fee_to_driver(db, order)
    db.commit()
    return {"message": "Livré."}


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Annule une commande de manière atomique :
    - Restaure le stock produit avec traçabilité (StockMovement).
    - Rembourse l'acheteur si les fonds sont en escrow.
    - Accessible par l'acheteur (avant collecte) ou par un admin.
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401)

    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    is_admin = utils.user_has_role(user, "admin")
    is_buyer = cast(int, order.buyer_id) == user.id
    if not (is_admin or is_buyer):
        raise HTTPException(status_code=403, detail="Vous ne pouvez annuler que vos propres commandes.")

    # Déterminer l'acteur pour l'audit trail
    cancelled_by = f"admin:{user.id}" if is_admin else f"buyer:{user.id}"

    try:
        result = payment_service.cancel_order_and_refund(db, order, cancelled_by=cancelled_by)
        db.commit()
        return {
            "message": "Commande annulée avec succès.",
            "order_id": utils.format_order_reference(order_id),
            "refund_amount": result["refund_amount"],
            "stock_restored": result["stock_restored"],
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'annulation: {str(e)}")
