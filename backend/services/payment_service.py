from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime
from fastapi import HTTPException

import models, schemas, config, utils

class PaymentService:
    """
    Service de gestion des paiements et de l'Escrow (Séquestre).
    Assure la conformité financière et évite les pertes de fonds.
    """
    
    @staticmethod
    def process_order_payment_to_escrow(db: Session, order: models.Order) -> bool:
        """
        Simule le retrait des fonds de l'acheteur (Orange/Lumicash) et 
        le marquage de la commande comme payée en Escrow.
        """
        # En production: Appel API Lumicash/Ecocash ici
        # if not call_mobile_money_api(order.buyer.phone_number, order.total_price):
        #     return False
        
        # Log de transaction
        db.add(models.TransactionLog(
            user_id=order.buyer_id,
            order_id=order.id,
            amount=-order.total_price, # Débit acheteur (simulé dans le monde réel)
            action="FUNDS_SENT_TO_ESCROW"
        ))
        
        order.status = "PAID_ESCROW"
        db.commit()
        return True

    @staticmethod
    def release_funds_to_farmer(db: Session, order: models.Order) -> bool:
        """
        Libère les fonds de l'Escrow vers le solde du fermier après livraison.
        Déduit la commission AgriConnect.
        """
        if order.status not in ["delivered", "COMPLETED"]:
            raise HTTPException(status_code=400, detail="La commande doit être livrée pour libérer les fonds.")

        # Calculer les montants
        total_ttc = order.total_price or Decimal("0")
        subtotal_ht = order.subtotal_price or total_ttc
        
        # Commission (sur le HT pour être propre fiscalement)
        commission_rate = config.DEFAULT_COMMISSION_RATE
        commission_amount = subtotal_ht * commission_rate
        net_to_farmer = total_ttc - commission_amount
        
        # 1. Créditer le fermier
        farmer = db.query(models.User).filter(models.User.id == order.farmer_id).first()
        if not farmer:
            raise HTTPException(status_code=404, detail="Fermier non trouvé")
            
        farmer.balance += net_to_farmer
        
        # 2. Log de transaction (Crédit Fermier)
        db.add(models.TransactionLog(
            user_id=order.farmer_id,
            order_id=order.id,
            amount=net_to_farmer,
            action="FUNDS_RELEASED"
        ))
        
        # 3. Log de commission (Revenu AgriConnect)
        db.add(models.AdminAuditLog(
            admin_user_id=None,
            action="COMMISSION_COLLECTED",
            entity_type="order",
            entity_id=order.id,
            detail=f"Commission de {commission_amount} BIF collectée pour la commande {order.id}"
        ))
        
        db.commit()
        return True

payment_service = PaymentService()
