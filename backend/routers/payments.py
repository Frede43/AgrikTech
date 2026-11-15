"""
Webhook de confirmation mobile money.

Quand MOBILE_MONEY_PROVIDER=api, une commande reste en PENDING_PAYMENT après sa
création ; l'agrégateur confirme (ou refuse) le paiement en appelant ce webhook.
Le secret partagé MOBILE_MONEY_WEBHOOK_SECRET authentifie l'appelant.
"""
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
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
    provider_ref: Optional[str] = Field(default=None, min_length=3, max_length=120)


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
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Commande inconnue pour cette référence.")

    # Une commande déjà comptabilisée ne doit pas être traitée deux fois.
    payment_log = db.query(models.TransactionLog.id).filter(
        models.TransactionLog.order_id == order.id,
        models.TransactionLog.action == "FUNDS_SENT_TO_ESCROW",
    ).first()
    if payment_log:
        return {"processed": False, "order_status": order.status}

    # Compatibilité avec les anciennes commandes que l'admin avait affectées
    # avant le webhook et qui ont été marquées READY_FOR_PICKUP sans paiement.
    if str(order.status) not in ("PENDING_PAYMENT", "READY_FOR_PICKUP"):
        return {"processed": False, "order_status": order.status}

    status = payload.status.strip().upper()
    if status == "SUCCESS":
        provider_reference = payload.provider_ref.strip() if payload.provider_ref else None
        if payload.provider_ref is not None and not provider_reference:
            raise HTTPException(status_code=400, detail="Référence fournisseur invalide.")
        if config.IS_PRODUCTION and not provider_reference:
            raise HTTPException(status_code=400, detail="La confirmation doit inclure la référence unique du fournisseur.")
        try:
            payment_service.process_order_payment_to_escrow(db, order, provider_reference)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Cette référence fournisseur est déjà utilisée.")
        return {"processed": True, "order_status": order.status}
    if status == "FAILED":
        payment_service.cancel_order_and_refund(
            db,
            order,
            cancelled_by="mobile_money_webhook",
            payment_failed=True,
        )
        db.commit()
        return {"processed": True, "order_status": order.status}

    raise HTTPException(status_code=400, detail=f"Statut webhook non reconnu: {payload.status}")
