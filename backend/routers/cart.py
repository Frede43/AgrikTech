from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from pydantic import BaseModel

import backend.models as models
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
def validate_cart(req: CartValidateRequest, db: Session = Depends(get_db)):
    valid = True
    result_items = []
    subtotal = 0.0
    available_total = 0.0
    global_issues = []

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
            })
            valid = False
            continue

        issues = []
        status = "ok"
        validated_qty = item.quantity
        current_price = float(product.price_per_kg)

        if not product.is_active:
            status = "unavailable"
            validated_qty = 0
            issues.append(f"Le produit {product.name} a été retiré de la vente.")
        elif float(product.quantity_kg) < item.quantity:
            status = "stock_changed"
            validated_qty = max(0, float(product.quantity_kg))
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
            "available_stock": float(product.quantity_kg),
            "status": status,
            "issues": issues,
            "line_total": line_total,
        })

    return {
        "valid": valid,
        "items": result_items,
        "subtotal": subtotal,
        "available_total": available_total,
        "issues": global_issues
    }
