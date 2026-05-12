from sqlalchemy.orm import Session
from typing import List, Optional
import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils

class OrderService:
    """
    Service de gestion du cycle de vie des commandes AgriConnect.
    """
    
    # Constantes de statut (Sync avec main.py)
    PAID_ESCROW = "PAID_ESCROW"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED_PENDING = "DELIVERED_PENDING_CONFIRMATION"
    COMPLETED = "COMPLETED"
    DISPUTED = "DISPUTED"

    @staticmethod
    def is_available_for_pickup(status: str) -> bool:
        return status in ["PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP"]

    @staticmethod
    def is_in_delivery_phase(status: str) -> bool:
        return status in ["PICKED_UP", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"]

    @staticmethod
    def get_query_statuses(status_filter: str) -> List[str]:
        if status_filter == "pending":
            return ["PAID_ESCROW"]
        if status_filter == "active":
            return ["PICKED_UP", "IN_TRANSIT"]
        if status_filter == "completed":
            return ["COMPLETED"]
        return []

    @staticmethod
    def get_logistics_priority(order: models.Order, distance_km: float) -> str:
        if distance_km > 50: return "high"
        if order.status == "PICKED_UP": return "medium"
        return "low"

order_service = OrderService()
