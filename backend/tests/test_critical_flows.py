import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class CriticalFlowsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{Path(cls._tmpdir.name) / 'test.db'}"
        os.chdir(BACKEND_DIR)
        for name in ("main", "models", "schemas", "database"):
            sys.modules.pop(name, None)
        cls.database = importlib.import_module("database")
        cls.models = importlib.import_module("models")
        cls.schemas = importlib.import_module("schemas")
        cls.main = importlib.import_module("main")

    @classmethod
    def tearDownClass(cls):
        cls.database.engine.dispose()
        cls._tmpdir.cleanup()

    def setUp(self):
        self.models.Base.metadata.drop_all(bind=self.database.engine)
        self.models.Base.metadata.create_all(bind=self.database.engine)
        self.db = self.database.SessionLocal()

    def tearDown(self):
        self.db.close()

    def create_user(self, phone_number: str, role: str, name: str):
        return self.main.create_user(
            self.schemas.UserCreate(
                phone_number=phone_number,
                role=role,
                name=name,
                province="Bujumbura",
            ),
            db=self.db,
        )

    def create_product(self, farmer_id: int, quantity_kg: float = 100.0, price_per_kg: float = 2000.0):
        return self.main.create_product(
            self.schemas.ProductCreate(
                name="Tomates",
                category="legumes",
                price_per_kg=price_per_kg,
                unit="kg",
                quantity_kg=quantity_kg,
                province="Kayanza",
            ),
            farmer_id=farmer_id,
            db=self.db,
        )

    def seed_order_context(self):
        farmer = self.create_user("+257700000001", "farmer", "Fermier Test")
        buyer = self.create_user("+257700000002", "buyer", "Acheteur Test")
        driver = self.create_user("+257700000003", "driver", "Livreur Test")
        product = self.create_product(farmer.id)
        order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=5),
            buyer_id=buyer.id,
            db=self.db,
        )
        return farmer, buyer, driver, product, order

    def test_create_user_normalizes_role_aliases(self):
        user = self.create_user("+257799999999", "farmer", "Alias Fermier")
        self.assertEqual(user.role, "fermier")

    def test_order_lifecycle_updates_stock_stats_and_transactions(self):
        farmer, _buyer, driver, product, order = self.seed_order_context()

        refreshed_product = self.db.query(self.models.Product).filter_by(id=product.id).first()
        self.assertEqual(order.status, self.main.ORDER_STATUS_PAID_ESCROW)
        self.assertEqual(refreshed_product.quantity_kg, 95.0)
        self.assertTrue(order.pickup_qr_token.startswith("QR-"))

        detail = self.main.get_order_detail(order.id, db=self.db)
        self.assertEqual(detail["status"], "pending")

        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        refreshed_after_pickup = self.db.query(self.models.Order).filter_by(id=order.id).first()
        stats_after_pickup = self.main.get_farmer_stats(farmer.id, db=self.db)
        self.assertEqual(refreshed_after_pickup.status, self.main.ORDER_STATUS_PICKED_UP)
        self.assertAlmostEqual(stats_after_pickup["pending_payout"], 9500.0)

        delivery = self.main.deliver_order(order.id, order.delivery_otp, db=self.db)
        refreshed_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        refreshed_farmer = self.db.query(self.models.User).filter_by(id=farmer.id).first()
        txns = self.main.get_user_transactions(farmer.id, db=self.db)
        stats_after_delivery = self.main.get_farmer_stats(farmer.id, db=self.db)

        self.assertAlmostEqual(delivery["farmer_credited"], 9500.0)
        self.assertAlmostEqual(delivery["agriconnect_commission"], 500.0)
        self.assertEqual(refreshed_order.status, self.main.ORDER_STATUS_COMPLETED)
        self.assertAlmostEqual(refreshed_farmer.balance, 9500.0)
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0]["status"], "paid")
        self.assertEqual(txns[0]["items"], "Tomates")
        self.assertAlmostEqual(stats_after_delivery["total_sales_bif"], 10000.0)
        self.assertAlmostEqual(stats_after_delivery["pending_payout"], 0.0)

    def test_dispute_freezes_order_and_resolution_restores_previous_phase(self):
        _farmer, _buyer, driver, _product, order = self.seed_order_context()
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257700000004",
                name="Admin Litiges",
                province="Bujumbura",
            ),
            db=self.db,
        )

        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        dispute = self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=order.id,
                reason="Livraison bloquée",
                detail="Le colis doit être vérifié avant remise.",
                refund_requested=0,
                priority="high",
            ),
            db=self.db,
        )

        disputed_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        self.assertEqual(disputed_order.status, self.main.ORDER_STATUS_DISPUTED)
        self.assertEqual(self.main.get_order_detail(order.id, db=self.db)["status"], "disputed")
        self.assertEqual(dispute["status"], "open")

        reviewed = self.main.review_dispute(
            dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )
        rejected = self.main.reject_dispute(
            dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )

        resolved_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        review_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="DISPUTE_REVIEWED",
            entity_type="dispute",
            entity_id=dispute["dbId"],
        ).one()
        reject_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="DISPUTE_REJECTED",
            entity_type="dispute",
            entity_id=dispute["dbId"],
        ).one()

        self.assertEqual(reviewed["status"], "in-review")
        self.assertEqual(rejected["status"], "resolved")
        self.assertEqual(rejected["resolution"], "Demande rejetée après vérification administrative manuelle.")
        self.assertEqual(resolved_order.status, self.main.ORDER_STATUS_PICKED_UP)
        self.assertEqual(review_audit.admin_user_id, admin.id)
        self.assertEqual(reject_audit.admin_user_id, admin.id)

    def test_dispute_refund_records_admin_audit_and_manual_resolution_message(self):
        _farmer, _buyer, driver, _product, order = self.seed_order_context()
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257700000014",
                name="Admin Remboursement",
                province="Bujumbura",
            ),
            db=self.db,
        )

        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        dispute = self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=order.id,
                reason="Produit non conforme",
                detail="Le lot reçu ne correspond pas à la qualité attendue.",
                refund_requested=7000,
                priority="high",
            ),
            db=self.db,
        )

        refunded = self.main.refund_dispute(
            dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )

        restored_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        refund_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="DISPUTE_REFUND_INITIATED",
            entity_type="dispute",
            entity_id=dispute["dbId"],
        ).one()

        self.assertEqual(refunded["status"], "resolved")
        self.assertEqual(
            refunded["resolution"],
            "Remboursement manuel interne simulé lancé pour 7000 BIF.",
        )
        self.assertEqual(restored_order.status, self.main.ORDER_STATUS_PICKED_UP)
        self.assertEqual(refund_audit.admin_user_id, admin.id)

    def test_pickup_and_delivery_reject_invalid_validation_codes(self):
        _farmer, _buyer, driver, _product, order = self.seed_order_context()

        with self.assertRaises(HTTPException):
            self.main.pickup_order(order.id, "QR-FAUX", driver.id, db=self.db)

        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        with self.assertRaises(HTTPException):
            self.main.deliver_order(order.id, "0000", db=self.db)


if __name__ == "__main__":
    unittest.main()

