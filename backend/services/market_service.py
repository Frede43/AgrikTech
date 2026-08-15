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
        history_30d = now - timedelta(days=30)
        history_7d = now - timedelta(days=7)
        
        normalized_scope_province = utils.normalize_market_province(province)
        
        # 1. Récupérer les produits actifs et disponibles
        query = db.query(models.Product).filter(
            models.Product.quantity_kg > 0,
            models.Product.is_active == True
        )
        active_products = query.all()
        
        # 2. Récupérer les prix historiques pour calculer les tendances
        past_orders = (
            db.query(models.Order)
            .options(joinedload(models.Order.product))
            .filter(
                models.Order.status.in_(["delivered", "COMPLETED"]),
                models.Order.created_at >= history_30d,
            )
            .all()
        )
        
        # Calcul des moyennes historiques par produit/unité
        # Format: {(name, unit): [prices_7d, prices_30d]}
        history_stats = {}
        for o in past_orders:
            if not o.product: continue
            key = (o.product.name.lower(), (o.product.unit or "kg").lower())
            if key not in history_stats:
                history_stats[key] = {"7d": [], "30d": []}
            
            price_per_unit = float(o.total_price / Decimal(str(o.quantity))) if o.quantity else 0
            history_stats[key]["30d"].append(price_per_unit)
            if o.created_at >= history_7d:
                history_stats[key]["7d"].append(price_per_unit)

        # 3. Calculer les prix actuels basés sur les annonces
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
            avg_current = float(data["price_sum"] / data["count"]) if data["count"] > 0 else 0.0
            
            # Calcul de la tendance
            trend = "stable"
            stats = history_stats.get(key)
            if stats and stats["7d"] and stats["30d"]:
                avg_7d = sum(stats["7d"]) / len(stats["7d"])
                avg_30d = sum(stats["30d"]) / len(stats["30d"])
                
                diff_pct = (avg_7d - avg_30d) / avg_30d if avg_30d > 0 else 0
                if diff_pct > 0.05: trend = "up"
                elif diff_pct < -0.05: trend = "down"

            results.append({
                "product": data["product"],
                "price": round(avg_current, 2),
                "unit": data["unit"],
                "provinces_count": len(data["provinces"]),
                "trend": trend,
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
