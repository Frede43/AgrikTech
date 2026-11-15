from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import backend.models as models, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/stock-movements",
    tags=["Stock Movements"]
)

@router.get("")
def get_stock_movements(
    request: Request,
    farmer_id: Optional[int] = None,
    product_id: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session requise.")

    query = db.query(models.StockMovement)

    if utils.user_has_role(current_user, "admin"):
        if farmer_id:
            query = query.filter(models.StockMovement.farmer_id == farmer_id)
    elif utils.user_has_role(current_user, "farmer"):
        query = query.filter(models.StockMovement.farmer_id == current_user.id)
    else:
        raise HTTPException(status_code=403, detail="Accès réservé aux fermiers et administrateurs.")
        
    if product_id and product_id != "all":
        try:
            pid = int(product_id)
            query = query.filter(models.StockMovement.product_id == pid)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Identifiant produit invalide.") from exc

    movements = query.order_by(models.StockMovement.created_at.desc()).limit(limit).all()
    
    results = []
    for m in movements:
        results.append({
            "id": m.id,
            "product_id": m.product_id,
            "farmer_id": m.farmer_id,
            "movement_type": m.movement_type,
            "quantity_delta": m.quantity_delta,
            "quantity_before": m.quantity_before,
            "quantity_after": m.quantity_after,
            "unit": m.unit,
            "product_name_snapshot": m.product_name_snapshot,
            "reason": m.reason,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return results
