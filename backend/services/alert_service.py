from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from decimal import Decimal
import backend.models as models, backend.config as config, backend.utils as utils
from backend.services.sms_service import sms_service
from backend.services.market_service import market_service

class AlertService:
    """
    Service gérant les alertes automatiques (SMS/Notifications).
    """

    @staticmethod
    def check_market_price_alerts(db: Session):
        """
        Compare les prix actuels vs les prix d'il y a 7 jours.
        Si hausse > 10%, prévient les fermiers concernés par SMS.
        """
        current_prices = market_service.get_live_prices(db)
        # Note: Dans une version réelle, on comparerait avec une table de prix historique.
        # Ici on simule l'envoi d'alertes pour les produits en hausse.
        
        for p in current_prices:
            if p["trend"] == "up":
                # Alerter les fermiers qui vendent ce produit
                farmers = db.query(models.User).join(models.Product).filter(
                    models.Product.name.ilike(f"%{p['product']}%"),
                    models.User.role == "farmer"
                ).distinct().all()
                
                for f in farmers:
                    msg = f"SOKO LIVE: Le prix de {p['product']} est en hausse! Prix moyen: {p['price']} BIF. Profitez-en pour vendre sur AgriConnect."
                    sms_service.send_sms(f.phone_number, msg)

    @staticmethod
    def check_agricultural_calendar_alerts(db: Session):
        """
        Vérifie la date actuelle par rapport aux saisons A, B, C du Burundi.
        Envoie des conseils de plantation/récolte.
        """
        now = datetime.now()
        current_month = now.month
        current_day = now.day
        
        # Exemple: Début Saison B (Février)
        if current_month == 2 and current_day <= 5:
            msg = "CONSEIL AGRI: La Saison B commence! C'est le moment idéal pour planter les haricots et le maïs dans les plateaux centraux."
            AlertService._broadcast_to_farmers(db, msg)
            
        # Exemple: Fin Saison A (Janvier)
        if current_month == 1 and current_day >= 20:
            msg = "CONSEIL AGRI: La récolte de la Saison A approche. Préparez vos stocks sur AgriConnect pour trouver des acheteurs rapidement."
            AlertService._broadcast_to_farmers(db, msg)

    @staticmethod
    def _broadcast_to_farmers(db: Session, message: str):
        farmers = db.query(models.User).filter(models.User.role == "farmer").all()
        for f in farmers:
            sms_service.send_sms(f.phone_number, message)

alert_service = AlertService()
