from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils

class MarketService:
    """
    Service de gestion des prix du marché (Soko Live).
    Optimisé pour l'inclusion rurale et la performance.
    """
    
    @staticmethod
    def get_live_prices(db: Session, province: Optional[str] = None) -> List[Dict[str, Any]]:
        now = utils.utcnow_naive()
        history_cutoff = now - timedelta(days=30)
        recent_cutoff = now - timedelta(days=7)
        
        normalized_scope_province = utils.normalize_market_province(province)
        
        # Récupérer les produits actifs
        query = db.query(models.Product).filter(models.Product.quantity_kg > 0)
        if normalized_scope_province:
            # Note: On filtre par province si spécifié
            pass 
        active_products = query.all()
        
        # Récupérer les ventes récentes pour référence
        delivered_orders = (
            db.query(models.Order)
            .options(joinedload(models.Order.product))
            .filter(
                models.Order.status == "delivered",
                models.Order.created_at >= history_cutoff,
            )
            .all()
        )
        
        # Logique de calcul simplifiée pour la performance rurale
        market_data = {}
        
        for p in active_products:
            if normalized_scope_province and utils.normalize_market_province(p.province) != normalized_scope_province:
                continue
            
            key = (p.name.lower(), (p.unit or "kg").lower())
            if key not in market_data:
                market_data[key] = {
                    "product": p.name,
                    "unit": p.unit or "kg",
                    "price_sum": Decimal("0"),
                    "count": 0,
                    "provinces": set()
                }
            
            market_data[key]["price_sum"] += p.price_per_kg or Decimal("0")
            market_data[key]["count"] += 1
            if p.province:
                market_data[key]["provinces"].add(p.province)
                
        results = []
        for key, data in market_data.items():
            avg_price = data["price_sum"] / data["count"] if data["count"] > 0 else Decimal("0")
            results.append({
                "product": data["product"],
                "price": round(avg_price, 2),
                "unit": data["unit"],
                "provinces_count": len(data["provinces"]),
                "trend": "stable", # À calculer plus tard si besoin
            })
            
        return results

    @staticmethod
    def get_price_for_sms(db: Session, product_query: str) -> str:
        """
        Version ultra-légère pour le SMS/USSD.
        """
        prices = MarketService.get_live_prices(db)
        query = product_query.strip().lower()
        
        for p in prices:
            if query in p["product"].lower():
                return f"{p['product']}: {p['price']} BIF/{p['unit']}"
        
        return "Produit non trouvé ou pas encore listé."

market_service = MarketService()
