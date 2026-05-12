from sqlalchemy.orm import Session
from typing import Optional, Tuple
import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils

class ProductService:
    """
    Service de gestion des produits et des stocks d'AgriConnect.
    """
    
    @staticmethod
    def record_stock_movement(
        db: Session,
        product: models.Product,
        farmer_id: int,
        movement_type: str,
        quantity_delta: float,
        quantity_before: float,
        quantity_after: float,
        reason: Optional[str] = None,
    ):
        movement = models.StockMovement(
            product_id=product.id,
            farmer_id=farmer_id,
            product_name_snapshot=product.name,
            movement_type=movement_type,
            quantity_delta=quantity_delta,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            unit=product.unit or "kg",
            reason=reason,
        )
        db.add(movement)
        return movement

    @staticmethod
    def describe_stock_adjustment(
        before: float, 
        after: float, 
        code: Optional[str], 
        note: Optional[str]
    ) -> Tuple[str, str]:
        diff = after - before
        mtype = "manual_adjustment"
        if diff > 0:
            reason = f"Ajustement positif: +{diff}kg."
        else:
            reason = f"Ajustement négatif: {diff}kg."
            
        if code == "correction":
            reason = f"Correction d'inventaire: {reason}"
        elif code == "harvest":
            mtype = "harvest"
            reason = f"Nouvelle récolte: {reason}"
        elif code == "loss":
            mtype = "loss"
            reason = f"Perte/Avarie: {reason}"

        if note:
            reason = f"{reason} (Note: {note})"
            
        return mtype, reason

product_service = ProductService()
