from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/reviews",
    tags=["Reviews & Ratings"]
)

@router.post("/order/{order_id}")
def submit_order_review(
    order_id: int, 
    product_rating: int, 
    logistics_rating: int, 
    product_comment: Optional[str] = None,
    logistics_comment: Optional[str] = None,
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Permet à un acheteur d'évaluer à la fois le produit (fermier) et la livraison (logisticien).
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise.")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    
    if order.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Seul l'acheteur de cette commande peut laisser un avis.")

    if order.status not in ["DELIVERED", "COMPLETED"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez évaluer qu'une commande livrée.")

    # 1. Avis Produit
    product_review = models.ProductReview(
        product_id=order.product_id,
        buyer_id=user.id,
        order_id=order.id,
        rating=max(1, min(5, product_rating)),
        comment=product_comment
    )
    db.add(product_review)

    # 2. Avis Logistique (si un chauffeur était assigné)
    if order.driver_id:
        logistics_review = models.LogisticsReview(
            driver_id=order.driver_id,
            buyer_id=user.id,
            order_id=order.id,
            rating=max(1, min(5, logistics_rating)),
            comment=logistics_comment
        )
        db.add(logistics_review)

    db.commit()
    return {"message": "Merci pour votre évaluation !"}
