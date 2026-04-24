from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/stock-movements",
    tags=["Stock Movements"]
)

@router.get("")
def get_stock_movements(
    farmer_id: Optional[int] = None,
    product_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(models.StockMovement)
    
    if farmer_id:
        query = query.filter(models.StockMovement.farmer_id == farmer_id)
        
    if product_id and product_id != "all":
        try:
            pid = int(product_id)
            query = query.filter(models.StockMovement.product_id == pid)
        except ValueError:
            pass

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
