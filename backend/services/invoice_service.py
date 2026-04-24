from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
import models, config, utils

class InvoiceService:
    """
    Service de génération de factures conformes OBR Burundi.
    Optimisé pour être léger (Rural-friendly).
    """
    
    @staticmethod
    def generate_invoice_text(order: models.Order) -> str:
        """
        Génère une facture au format texte simple, 
        facile à envoyer par SMS ou à imprimer sur de petits terminaux.
        """
        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        invoice = f"--- FACTURE AGRICONNECT BURUNDI ---\n"
        invoice += f"Facture N°: {order.invoice_number or 'N/A'}\n"
        invoice += f"Date: {now}\n"
        invoice += f"-----------------------------------\n"
        invoice += f"VENDEUR (Fermier): {order.farmer.name}\n"
        invoice += f"NIF Vendeur: {order.farmer.nif_number or 'N/A'}\n"
        invoice += f"ACHETEUR: {order.buyer.name}\n"
        invoice += f"-----------------------------------\n"
        invoice += f"DESIGNATION: {order.product.name}\n"
        invoice += f"QUANTITE: {order.quantity} {order.product.unit}\n"
        invoice += f"TOTAL HT: {order.subtotal_price} BIF\n"
        invoice += f"TVA (18%): {order.vat_amount} BIF\n"
        invoice += f"TOTAL TTC: {order.total_price} BIF\n"
        invoice += f"-----------------------------------\n"
        invoice += f"Merci d'utiliser AgriConnect!\n"
        invoice += f"AgriConnect - Connecter les terres du Burundi."
        
        return invoice

invoice_service = InvoiceService()
