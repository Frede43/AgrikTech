import secrets
from typing import Optional

import requests

import backend.config as config


class SMSService:
    """
    Service d'envoi et de réception de SMS/USSD pour AgriConnect Burundi.
    Focus: Inclusion des zones rurales (Feature phones).

    Fournisseur choisi via SMS_PROVIDER :
      - "console"        : simulateur (défaut, dev/tests) — affiche le SMS en console
      - "twilio"         : API REST Twilio
      - "africastalking" : API REST Africa's Talking
      - "infobip"        : API REST Infobip
    """

    @property
    def provider(self) -> str:
        return config.SMS_PROVIDER

    @property
    def is_simulated(self) -> bool:
        """Vrai quand aucun fournisseur réel n'est configuré."""
        return self.provider not in ("twilio", "africastalking", "infobip")

    # ── Envoi ─────────────────────────────────────────────────────────────────

    def send_sms(self, phone_number: str, message: str) -> bool:
        if self.provider == "twilio":
            return self._send_via_twilio(phone_number, message)
        if self.provider == "africastalking":
            return self._send_via_africastalking(phone_number, message)
        if self.provider == "infobip":
            return self._send_via_infobip(phone_number, message)
        return self._send_via_console(phone_number, message)

    def send_otp(self, phone_number: str, otp_code: str) -> bool:
        message = f"AgriConnect: Votre code de connexion est {otp_code}. Ne le partagez pas."
        return self.send_sms(phone_number, message)

    @staticmethod
    def _send_via_console(phone_number: str, message: str) -> bool:
        print("\n" + "=" * 50)
        print("[AGRICONNECT SIMULATOR] ENVOI SMS")
        print(f"DESTINATAIRE : {phone_number}")
        print(f"MESSAGE      : {message}")
        print("=" * 50 + "\n")
        return True

    @staticmethod
    def _send_via_twilio(phone_number: str, message: str) -> bool:
        if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN and config.TWILIO_FROM_NUMBER):
            print("[SMS] Twilio mal configuré (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER).")
            return False
        try:
            resp = requests.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{config.TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN),
                data={"To": phone_number, "From": config.TWILIO_FROM_NUMBER, "Body": message},
                timeout=10,
            )
            if resp.status_code in (200, 201):
                return True
            print(f"[SMS] Erreur Twilio {resp.status_code}: {resp.text[:200]}")
            return False
        except requests.RequestException as exc:
            print(f"[SMS] Erreur réseau Twilio: {exc}")
            return False

    @staticmethod
    def _send_via_africastalking(phone_number: str, message: str) -> bool:
        if not (config.AFRICASTALKING_USERNAME and config.AFRICASTALKING_API_KEY):
            print("[SMS] Africa's Talking mal configuré (AFRICASTALKING_USERNAME / AFRICASTALKING_API_KEY).")
            return False
        data = {
            "username": config.AFRICASTALKING_USERNAME,
            "to": phone_number,
            "message": message,
        }
        if config.AFRICASTALKING_SENDER_ID:
            data["from"] = config.AFRICASTALKING_SENDER_ID
        try:
            resp = requests.post(
                "https://api.africastalking.com/version1/messaging",
                headers={
                    "apiKey": config.AFRICASTALKING_API_KEY,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=data,
                timeout=10,
            )
            if resp.status_code in (200, 201):
                recipients = resp.json().get("SMSMessageData", {}).get("Recipients", [])
                if recipients and recipients[0].get("status") == "Success":
                    return True
                print(f"[SMS] Africa's Talking a refusé l'envoi: {resp.text[:200]}")
                return False
            print(f"[SMS] Erreur Africa's Talking {resp.status_code}: {resp.text[:200]}")
            return False
        except requests.RequestException as exc:
            print(f"[SMS] Erreur réseau Africa's Talking: {exc}")
            return False

    @staticmethod
    def _send_via_infobip(phone_number: str, message: str) -> bool:
        if not (config.INFOBIP_BASE_URL and config.INFOBIP_API_KEY and config.INFOBIP_SENDER):
            print("[SMS] Infobip mal configuré (INFOBIP_BASE_URL / INFOBIP_API_KEY / INFOBIP_SENDER).")
            return False

        payload = {
            "messages": [{
                "sender": config.INFOBIP_SENDER,
                "destinations": [{"to": phone_number}],
                "content": {"text": message},
            }],
        }
        try:
            response = requests.post(
                f"{config.INFOBIP_BASE_URL}/sms/3/messages",
                headers={
                    "Authorization": f"App {config.INFOBIP_API_KEY}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10,
            )
            if response.status_code != 200:
                print(f"[SMS] Erreur Infobip {response.status_code}.")
                return False

            body = response.json()
            messages = body.get("messages", []) if isinstance(body, dict) else []
            if not isinstance(messages, list) or not messages or not isinstance(messages[0], dict):
                print("[SMS] Infobip n'a confirmé aucun message.")
                return False

            first_message = messages[0]
            status = first_message.get("status")
            if not first_message.get("messageId") or not isinstance(status, dict):
                print("[SMS] Réponse Infobip incomplète.")
                return False
            if status.get("groupName", "").upper() == "REJECTED":
                print("[SMS] Infobip a refusé l'envoi du message.")
                return False
            return True
        except (requests.RequestException, ValueError) as exc:
            print(f"[SMS] Erreur Infobip: {type(exc).__name__}.")
            return False

    # ── Réception (canal rural SMS entrant) ───────────────────────────────────

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
        return str(secrets.randbelow(900000) + 100000)


sms_service = SMSService()
