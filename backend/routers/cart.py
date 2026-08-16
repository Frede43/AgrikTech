from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Union, cast
from pydantic import BaseModel
from decimal import Decimal

import backend.models as models
import backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/cart",
    tags=["Cart"]
)

class CartItemInput(BaseModel):
    productId: Union[str, int]
    quantity: float
    price: float

class CartValidateRequest(BaseModel):
    items: List[CartItemInput]

@router.post("/validate")
def validate_cart(req: CartValidateRequest, request: Request, db: Session = Depends(get_db)):
    valid = True
    result_items = []
    subtotal = 0.0
    available_total = 0.0
    global_issues = []
    # Acheteur optionnel : le panier peut être consulté avant connexion, mais
    # sans acheteur identifié on ne peut pas calculer de vraie distance
    # (compute_delivery_fee retombe alors sur le forfait "provinces différentes").
    buyer = utils.get_authenticated_user(request, db)

    for item in req.items:
        # Tente de parser l'id s'il est au format "P001" (mock) ou entier
        pid = item.productId
        try:
            pid = int(pid)
        except ValueError:
            pass # Laisse en str si ce n'est pas un int, mais on filtrera

        product = db.query(models.Product).filter(models.Product.id == pid).first() if isinstance(pid, int) else None
        
        # Pour gérer les anciens mock products dans le local_storage s'il y en a:
        if not product:
            result_items.append({
                "product_id": item.productId,
                "name": "Produit introuvable",
                "requested_quantity": item.quantity,
                "validated_quantity": 0,
                "requested_price": item.price,
                "current_price": 0,
                "available_stock": 0,
                "status": "unavailable",
                "issues": ["Ce produit n'est plus disponible au catalogue."],
                "line_total": 0,
                "farmer_id": 0
            })
            valid = False
            continue

        issues = []
        status = "ok"
        validated_qty = item.quantity
        current_price = float(cast(Decimal, product.price_per_kg))

        if not product.is_active:
            status = "unavailable"
            validated_qty = 0
            issues.append(f"Le produit {product.name} a été retiré de la vente.")
        elif float(cast(Decimal, product.quantity_kg)) < item.quantity:
            status = "stock_changed"
            validated_qty = max(0, float(cast(Decimal, product.quantity_kg)))
            if validated_qty == 0:
                status = "unavailable"
                issues.append(f"Le produit {product.name} est en rupture de stock.")
            else:
                issues.append(f"Stock insuffisant. Seulement {validated_qty} {product.unit} disponible(s) pour {product.name}.")
        
        if status != "unavailable" and current_price != item.price:
            if status == "ok":
                status = "price_changed"
            issues.append(f"Le prix de {product.name} a changé (Ancien: {item.price}, Nouveau: {current_price}).")

        if status != "ok":
            valid = False

        line_total = validated_qty * current_price
        subtotal += item.quantity * item.price
        available_total += line_total

        result_items.append({
            "product_id": product.id,
            "name": product.name,
            "requested_quantity": item.quantity,
            "validated_quantity": validated_qty,
            "requested_price": item.price,
            "current_price": current_price,
            "available_stock": float(cast(Decimal, product.quantity_kg)),
            "status": status,
            "issues": issues,
            "line_total": line_total,
            "farmer_id": product.farmer_id
        })

    # Frais de livraison réel par vendeur (même calcul, mêmes constantes que
    # orders.py::create_order — un panier scindé en une commande par fermier
    # à la validation paiera exactement ce qui est annoncé ici).
    farmer_ids = sorted({
        it["farmer_id"] for it in result_items
        if it["farmer_id"] and it["status"] != "unavailable"
    })
    delivery_fees = []
    total_delivery_fee = 0.0
    for fid in farmer_ids:
        seller = db.query(models.User).filter(models.User.id == fid).first()
        fee = float(utils.compute_delivery_fee(buyer, seller))
        delivery_fees.append({"farmer_id": fid, "delivery_fee": fee})
        total_delivery_fee += fee

    return {
        "valid": valid,
        "items": result_items,
        "subtotal": subtotal,
        "delivery_fees": delivery_fees,
        "total_delivery_fee": total_delivery_fee,
        "available_total": available_total,
        "issues": global_issues
    }
