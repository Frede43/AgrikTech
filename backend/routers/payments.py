"""
Webhook de confirmation mobile money.

Quand MOBILE_MONEY_PROVIDER=api, une commande reste en PENDING_PAYMENT après sa
création ; l'agrégateur confirme (ou refuse) le paiement en appelant ce webhook.
Le secret partagé MOBILE_MONEY_WEBHOOK_SECRET authentifie l'appelant.
"""
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

import backend.config as config
import backend.models as models
from backend.database import get_db
from backend.services.payment_service import payment_service

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


class PaymentWebhookPayload(BaseModel):
    reference: str  # invoice_number de la commande
    status: str     # SUCCESS | FAILED
    provider_ref: Optional[str] = None


@router.post("/webhook")
def payment_webhook(
    payload: PaymentWebhookPayload,
    x_webhook_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    if not config.MOBILE_MONEY_WEBHOOK_SECRET or not hmac.compare_digest(
        x_webhook_secret, config.MOBILE_MONEY_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Signature webhook invalide.")

    order = (
        db.query(models.Order)
        .filter(models.Order.invoice_number == payload.reference)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Commande inconnue pour cette référence.")

    # Idempotence : un webhook rejoué sur une commande déjà traitée ne change rien.
    if str(order.status) != "PENDING_PAYMENT":
        return {"processed": False, "order_status": order.status}

    status = payload.status.strip().upper()
    if status == "SUCCESS":
        payment_service.process_order_payment_to_escrow(db, order)
        db.commit()
        return {"processed": True, "order_status": order.status}
    if status == "FAILED":
        payment_service.cancel_order_and_refund(db, order, cancelled_by="mobile_money_webhook")
        db.commit()
        return {"processed": True, "order_status": order.status}

    raise HTTPException(status_code=400, detail=f"Statut webhook non reconnu: {payload.status}")
