import os
import random
from typing import Optional, Dict

class SMSService:
    """
    Service d'envoi et de réception de SMS/USSD pour AgriConnect Burundi.
    Focus: Inclusion des zones rurales (Feature phones).
    """
    
    @staticmethod
    def send_sms(phone_number: str, message: str) -> bool:
        print("\n" + "="*50)
        print("[AGRICONNECT SIMULATOR] ENVOI SMS")
        print(f"DESTINATAIRE : {phone_number}")
        print(f"MESSAGE      : {message}")
        print("="*50 + "\n")
        return True

    @staticmethod
    def send_otp(phone_number: str, otp_code: str) -> bool:
        message = f"AgriConnect: Votre code de connexion est {otp_code}. Ne le partagez pas."
        return SMSService.send_sms(phone_number, message)

    @staticmethod
    def handle_incoming_sms(phone_number: str, text: str) -> str:
        """
        Simule le traitement d'un SMS entrant (Interface type rural).
        Exemple: L'utilisateur envoie 'SOLDE' au numéro court d'AgriConnect.
        """
        cmd = text.strip().upper()
        
        if cmd == "SOLDE":
            return "AgriConnect: Votre solde actuel est de 15 000 BIF."
        elif cmd.startswith("PRIX"):
            return "AgriConnect: Haricot: 2200 BIF/kg, Riz: 3500 BIF/kg (Province Gitega)."
        elif cmd == "AIDE":
            return "Commandes: SOLDE, PRIX, STOCK. AgriConnect vous connecte au marché."
        
        return "AgriConnect: Commande non reconnue. Tapez AIDE pour voir les options."

    @staticmethod
    def generate_otp() -> str:
        return str(random.randint(1000, 9999))

sms_service = SMSService()
