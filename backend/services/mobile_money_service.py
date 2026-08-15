"""
Abstraction mobile money (Lumicash / Ecocash) pour AgriConnect Burundi.

Fournisseur choisi via MOBILE_MONEY_PROVIDER :
  - "mock" (défaut) : le paiement est considéré comme réussi immédiatement —
    comportement historique du prototype, utilisé en dev et dans les tests.
  - "api" : agrégateur REST générique (MOBILE_MONEY_API_URL + MOBILE_MONEY_API_KEY).
    L'initiation retourne "PENDING" ; la confirmation arrive ensuite par le
    webhook POST /payments/webhook (voir routers/payments.py).

Les API Lumicash/Ecocash n'étant pas publiques, l'adaptateur "api" cible un
agrégateur (ou une passerelle interne) exposant un contrat simple :
  POST {MOBILE_MONEY_API_URL}/collections  {phone_number, amount, currency, reference}
  POST {MOBILE_MONEY_API_URL}/payouts      {phone_number, amount, currency, reference}
Réponse attendue : {"status": "PENDING"|"SUCCESS"|"FAILED", "provider_ref": "..."}
"""
from decimal import Decimal
from typing import Optional

import requests

import backend.config as config

STATUS_SUCCESS = "SUCCESS"
STATUS_PENDING = "PENDING"
STATUS_FAILED = "FAILED"


class MobileMoneyService:

    @property
    def provider(self) -> str:
        return config.MOBILE_MONEY_PROVIDER

    @property
    def is_mock(self) -> bool:
        return self.provider != "api"

    def initiate_collection(self, phone_number: Optional[str], amount: Decimal, reference: str) -> dict:
        """Débite le client (acheteur) vers le compte séquestre AgriConnect."""
        if self.is_mock:
            return {"status": STATUS_SUCCESS, "provider_ref": f"MOCK-COL-{reference}"}
        return self._call_api("collections", phone_number, amount, reference)

    def initiate_payout(self, phone_number: Optional[str], amount: Decimal, reference: str) -> dict:
        """Verse des fonds (retrait fermier) vers un portefeuille mobile money."""
        if self.is_mock:
            return {"status": STATUS_SUCCESS, "provider_ref": f"MOCK-PAY-{reference}"}
        return self._call_api("payouts", phone_number, amount, reference)

    @staticmethod
    def _call_api(endpoint: str, phone_number: Optional[str], amount: Decimal, reference: str) -> dict:
        if not (config.MOBILE_MONEY_API_URL and config.MOBILE_MONEY_API_KEY):
            print("[MOBILE MONEY] Fournisseur 'api' mal configuré (MOBILE_MONEY_API_URL / MOBILE_MONEY_API_KEY).")
            return {"status": STATUS_FAILED, "provider_ref": None}
        try:
            resp = requests.post(
                f"{config.MOBILE_MONEY_API_URL.rstrip('/')}/{endpoint}",
                headers={"Authorization": f"Bearer {config.MOBILE_MONEY_API_KEY}"},
                json={
                    "phone_number": phone_number,
                    "amount": str(amount),
                    "currency": "BIF",
                    "reference": reference,
                },
                timeout=15,
            )
            if resp.status_code in (200, 201, 202):
                data = resp.json()
                status = str(data.get("status", STATUS_PENDING)).upper()
                if status not in (STATUS_SUCCESS, STATUS_PENDING, STATUS_FAILED):
                    status = STATUS_PENDING
                return {"status": status, "provider_ref": data.get("provider_ref")}
            print(f"[MOBILE MONEY] Erreur {resp.status_code} sur {endpoint}: {resp.text[:200]}")
            return {"status": STATUS_FAILED, "provider_ref": None}
        except requests.RequestException as exc:
            print(f"[MOBILE MONEY] Erreur réseau sur {endpoint}: {exc}")
            return {"status": STATUS_FAILED, "provider_ref": None}


mobile_money_service = MobileMoneyService()
