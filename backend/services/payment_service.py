from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException

import backend.models as models
import backend.config as config
import backend.utils as utils


class PaymentService:
    """
    Service de gestion des paiements et de l'Escrow (Séquestre).
    Assure la conformité financière et évite les pertes de fonds.
    """

    @staticmethod
    def process_order_payment_to_escrow(db: Session, order: models.Order) -> bool:
        """
        Simule le retrait des fonds de l'acheteur (Lumicash/Ecocash) et
        marque la commande comme payée en Escrow.
        En production : Appel API Mobile Money ici.
        """
        db.add(models.TransactionLog(
            user_id=order.buyer_id,
            order_id=order.id,
            amount=-(order.total_price or Decimal("0")),
            action="FUNDS_SENT_TO_ESCROW",
        ))
        order.status = "PAID_ESCROW"  # type: ignore
        # Le commit est délégué à l'appelant pour garantir l'atomicité
        return True

    @staticmethod
    def release_funds_to_farmer(db: Session, order: models.Order) -> dict:
        """
        Libère les fonds de l'Escrow vers le solde du fermier après livraison.
        Déduit la commission AgriConnect : taux promotionnel (PROMO_COMMISSION_RATE)
        sur les PROMO_SALES_THRESHOLD premières ventes livrées du fermier, puis
        DEFAULT_COMMISSION_RATE ensuite. Compte les ventes du fermier lui-même
        (order.farmer_id), y compris celles vendues au nom d'une coopérative dont
        il est membre — même personne, même courbe d'apprentissage.
        """
        if order.status not in ["delivered", "COMPLETED"]:
            raise HTTPException(
                status_code=400,
                detail="La commande doit être livrée pour libérer les fonds.",
            )

        # total_price inclut delivery_fee (voir orders.py::create_order) —
        # celui-ci revient au livreur (release_delivery_fee_to_driver), pas
        # au fermier, donc on le retire avant de calculer le net fermier.
        delivery_fee = order.delivery_fee or Decimal("0")
        product_total_ttc = (order.total_price or Decimal("0")) - delivery_fee
        subtotal_ht = order.subtotal_price or product_total_ttc

        prior_completed_sales = db.query(models.Order).filter(
            models.Order.farmer_id == order.farmer_id,
            models.Order.status.in_(["delivered", "COMPLETED"]),
            models.Order.id != order.id,
        ).count()
        is_promo = prior_completed_sales < config.PROMO_SALES_THRESHOLD
        commission_rate = config.PROMO_COMMISSION_RATE if is_promo else config.DEFAULT_COMMISSION_RATE

        commission_amount = subtotal_ht * commission_rate
        net_to_farmer = product_total_ttc - commission_amount

        farmer = db.query(models.User).filter(models.User.id == order.farmer_id).first()
        if not farmer:
            raise HTTPException(status_code=404, detail="Fermier non trouvé.")

        farmer.balance += net_to_farmer  # type: ignore

        db.add(models.TransactionLog(
            user_id=order.farmer_id,
            order_id=order.id,
            amount=net_to_farmer,
            action="FUNDS_RELEASED",
        ))

        db.add(models.AdminAuditLog(
            admin_user_id=None,
            action="COMMISSION_COLLECTED",
            entity_type="order",
            entity_id=int(order.id),  # type: ignore
            detail=(
                f"Commission de {commission_amount} BIF collectée "
                f"({'taux promo ' if is_promo else 'taux standard '}"
                f"{commission_rate * 100}%) sur commande "
                f"{utils.format_order_reference(int(order.id))}. "  # type: ignore
                f"Net fermier: {net_to_farmer} BIF."
            ),
        ))

        return {
            "released": True,
            "commission_rate": commission_rate,
            "commission_amount": commission_amount,
            "net_to_farmer": net_to_farmer,
            "promo_applied": is_promo,
            "sale_number": prior_completed_sales + 1,
        }

    @staticmethod
    def release_delivery_fee_to_driver(db: Session, order: models.Order) -> Optional[Decimal]:
        """
        Verse au livreur la totalité du delivery_fee de la commande (aucune
        commission plateforme prélevée dessus). Ne fait rien silencieusement
        si aucun livreur n'est assigné ou si delivery_fee est nul — évite de
        planter la livraison pour une commande créée avant cette fonctionnalité
        (delivery_fee=0 par défaut, colonne ajoutée après coup en base).
        """
        delivery_fee = order.delivery_fee or Decimal("0")
        if delivery_fee <= 0 or not order.driver_id:
            return None

        driver = db.query(models.User).filter(models.User.id == order.driver_id).first()
        if not driver:
            return None

        driver.balance += delivery_fee  # type: ignore

        db.add(models.TransactionLog(
            user_id=order.driver_id,
            order_id=order.id,
            amount=delivery_fee,
            action="DELIVERY_FEE_RELEASED",
        ))

        return delivery_fee

    @staticmethod
    def cancel_order_and_refund(
        db: Session,
        order: models.Order,
        cancelled_by: str = "system",
    ) -> dict:
        """
        Annule atomiquement une commande :
          1. Valide que l'annulation est possible (statuts éligibles).
          2. Restaure le stock produit avec un StockMovement tracé.
          3. Rembourse l'acheteur si les fonds sont en escrow (PAID_ESCROW).
          4. Passe la commande en statut CANCELLED.
          5. Enregistre un AdminAuditLog.

        Le commit est délégué à l'appelant pour garantir l'atomicité globale.
        """
        CANCELLABLE_STATUSES = [
            "PENDING_PAYMENT",
            "PAID_ESCROW",
            "CONFIRMED",
            "READY_FOR_PICKUP",
            "PENDING",
        ]
        if str(order.status) not in CANCELLABLE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La commande ne peut pas être annulée "
                    f"(statut actuel: {order.status})."
                ),
            )

        refund_amount = Decimal("0")
        qty_restored = float(str(order.quantity or 0))

        # ── 1. Restauration atomique du stock ───────────────────────────────
        product = db.query(models.Product).filter(
            models.Product.id == order.product_id
        ).first()

        if product and qty_restored > 0:
            qty_before = float(str(product.quantity_kg or 0.0))
            qty_after = qty_before + qty_restored

            product.quantity_kg = qty_after  # type: ignore

            db.add(models.StockMovement(
                product_id=int(str(product.id)),
                farmer_id=int(str(order.farmer_id)), # type: ignore
                product_name_snapshot=str(product.name),
                movement_type="order_cancelled",
                quantity_delta=float(qty_restored),
                quantity_before=qty_before,
                quantity_after=qty_after,
                unit=str(product.unit or "kg"),
                reason=(
                    f"Annulation commande "
                    f"{utils.format_order_reference(int(order.id))} "  # type: ignore
                    f"par {cancelled_by}."
                ),
            ))

        # ── 2. Remboursement acheteur si fonds en escrow ────────────────────
        if str(order.status) == "PAID_ESCROW" and order.total_price:
            refund_amount = Decimal(str(order.total_price))
            buyer = db.query(models.User).filter(
                models.User.id == order.buyer_id
            ).first()
            if buyer:
                buyer.balance += refund_amount  # type: ignore

            db.add(models.TransactionLog(
                user_id=order.buyer_id,
                order_id=order.id,
                amount=refund_amount,
                action="REFUND_ISSUED",
            ))

        # ── 3. Mise à jour statut commande ──────────────────────────────────
        order.status = "CANCELLED"  # type: ignore

        # ── 4. Audit log ────────────────────────────────────────────────────
        db.add(models.AdminAuditLog(
            admin_user_id=None,
            action="ORDER_CANCELLED",
            entity_type="order",
            entity_id=int(order.id),  # type: ignore
            detail=(
                f"Commande {utils.format_order_reference(int(order.id))} "  # type: ignore
                f"annulée par {cancelled_by}. "
                f"Stock restauré: +{qty_restored} unités. "
                f"Remboursement: {refund_amount} BIF."
            ),
        ))

        return {
            "cancelled": True,
            "refund_amount": float(refund_amount),
            "stock_restored": qty_restored,
        }


payment_service = PaymentService()
