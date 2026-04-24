import importlib
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class OrderDetailsTransactionsAndStatsTests(unittest.TestCase):
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
        self.db.rollback()
        self.db.close()
        self.database.engine.dispose()

    def create_user(self, phone: str, role: str, name: str, province: str = "Bujumbura"):
        return self.main.create_user(self.schemas.UserCreate(phone_number=phone, role=role, name=name, province=province), db=self.db)

    def create_product(self, farmer_id: int, name: str = "Maïs", quantity: float = 20, price: float = 1000, province: str = "Gitega"):
        return self.main.create_product(
            self.schemas.ProductCreate(name=name, category="cereales", price_per_kg=price, unit="kg", quantity_kg=quantity, province=province),
            farmer_id=farmer_id,
            db=self.db,
        )

    def test_order_detail_returns_nested_payload_and_missing_order_404(self):
        farmer = self.create_user("+257770000001", "farmer", "Fermier Détail", province="Gitega")
        buyer = self.create_user("+257770000002", "buyer", "Acheteur Détail", province="Bujumbura")
        driver = self.create_user("+257770000003", "driver", "Livreur Détail", province="Ngozi")
        product = self.create_product(farmer.id)
        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=4), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)

        detail = self.main.get_order_detail(order.id, db=self.db)

        self.assertEqual(detail["orderId"], f"CMD-{order.id}")
        self.assertEqual(detail["status"], "collected")
        self.assertEqual(detail["farmer"]["name"], farmer.name)
        self.assertEqual(detail["buyer"]["phone"], buyer.phone_number)
        self.assertEqual(detail["items"][0]["name"], product.name)
        self.assertEqual(detail["items"][0]["qty"], 4)
        self.assertTrue(detail["totalWeight"].endswith("kg"))

        with self.assertRaises(HTTPException) as ctx:
            self.main.get_order_detail(999999, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_user_transactions_are_sorted_and_include_financial_breakdown(self):
        farmer = self.create_user("+257770000011", "farmer", "Fermier Tx")
        buyer = self.create_user("+257770000012", "buyer", "Acheteur Tx")
        driver = self.create_user("+257770000013", "driver", "Livreur Tx")
        product = self.create_product(farmer.id, quantity=30)

        order_one = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        order_two = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=3), buyer_id=buyer.id, db=self.db)
        for order in (order_one, order_two):
            self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
            self.main.deliver_order(order.id, order.delivery_otp, db=self.db)

        logs = self.db.query(self.models.TransactionLog).order_by(self.models.TransactionLog.id.asc()).all()
        logs[0].timestamp = datetime(2024, 1, 1, 8, 0, 0)
        logs[1].timestamp = datetime(2024, 1, 2, 8, 0, 0)
        self.db.commit()

        txns = self.main.get_user_transactions(farmer.id, db=self.db)

        self.assertEqual(len(txns), 2)
        self.assertEqual(txns[0]["id"], f"TXN-{logs[1].id}")
        self.assertTrue(txns[0]["date"].startswith("2024-01-02"))
        self.assertEqual(txns[0]["status"], "paid")
        self.assertEqual(txns[0]["items"], product.name)
        self.assertAlmostEqual(txns[0]["gross"], 3000.0)
        self.assertAlmostEqual(txns[0]["commission"], 150.0)
        self.assertAlmostEqual(txns[0]["net"], 2850.0)
        self.assertEqual(self.main.get_user_transactions(buyer.id, db=self.db), [])

    def test_user_transactions_include_pending_sales_and_payout_metadata(self):
        farmer = self.create_user("+257770000014", "farmer", "Fermier Tx Enrichi")
        buyer = self.create_user("+257770000015", "buyer", "Acheteur Tx Enrichi")
        driver = self.create_user("+257770000016", "driver", "Livreur Tx Enrichi")
        product = self.create_product(farmer.id, name="Café", quantity=10, price=10000)

        self.main.update_admin_settings(
            self.schemas.PlatformSettingsUpdate(commission_rate=0.10),
            db=self.db,
        )

        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)

        pending = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)

        delivered.created_at = datetime(2024, 1, 1, 8, 0, 0)
        pending.created_at = datetime(2024, 1, 2, 8, 0, 0)
        self.db.commit()

        self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                phone_number="+257799000000",
            ),
            db=self.db,
        )

        sale_log = self.db.query(self.models.TransactionLog).filter_by(action="FUNDS_RELEASED").one()
        withdrawal_request = self.db.query(self.models.WithdrawalRequest).filter_by(user_id=farmer.id).one()
        sale_log.timestamp = datetime(2024, 1, 1, 12, 0, 0)
        withdrawal_request.created_at = datetime(2024, 1, 3, 8, 0, 0)
        self.db.commit()

        txns = self.main.get_user_transactions(farmer.id, db=self.db)

        self.assertEqual(len(txns), 3)

        payout_row = txns[0]
        self.assertEqual(payout_row["id"], f"WDR-{withdrawal_request.id}")
        self.assertEqual(payout_row["type"], "payout")
        self.assertEqual(payout_row["status"], "pending")
        self.assertEqual(payout_row["channel"], "Lumicash")
        self.assertEqual(payout_row["destination_phone"], "+257799000000")
        self.assertIsNone(payout_row["order_id"])
        self.assertEqual(payout_row["buyer"], "Retrait Lumicash")
        self.assertEqual(payout_row["items"], "Vers +257799000000")
        self.assertTrue(payout_row["date"].startswith("2024-01-03"))
        self.assertAlmostEqual(payout_row["gross"], 12000.0)
        self.assertAlmostEqual(payout_row["net"], -12000.0)
        self.assertIn("sous 24h", payout_row["note"])
        self.assertIn("numéro principal du compte", payout_row["note"])
        self.assertEqual(
            self.db.query(self.models.TransactionLog).filter_by(user_id=farmer.id, action="WITHDRAWAL_REQUEST").count(),
            0,
        )

        pending_row = txns[1]
        self.assertEqual(pending_row["id"], f"ORDER-{pending.id}")
        self.assertEqual(pending_row["status"], "pending")
        self.assertEqual(pending_row["order_id"], pending.id)
        self.assertEqual(pending_row["order_reference"], f"CMD-{pending.id}")
        self.assertEqual(pending_row["pickup_qr"], pending.pickup_qr_token)
        self.assertAlmostEqual(pending_row["gross"], 10000.0)
        self.assertAlmostEqual(pending_row["commission"], 1000.0)
        self.assertAlmostEqual(pending_row["net"], 9000.0)

        delivered_row = txns[2]
        self.assertEqual(delivered_row["id"], f"TXN-{sale_log.id}")
        self.assertEqual(delivered_row["status"], "paid")
        self.assertEqual(delivered_row["order_id"], delivered.id)
        self.assertEqual(delivered_row["order_reference"], f"CMD-{delivered.id}")
        self.assertEqual(delivered_row["pickup_qr"], delivered.pickup_qr_token)
        self.assertAlmostEqual(delivered_row["gross"], 20000.0)
        self.assertAlmostEqual(delivered_row["commission"], 2000.0)
        self.assertAlmostEqual(delivered_row["net"], 18000.0)

    def test_farmer_stats_handle_mixed_statuses_and_missing_user(self):
        farmer = self.create_user("+257770000021", "farmer", "Fermier Stats")
        buyer = self.create_user("+257770000022", "buyer", "Acheteur Stats")
        driver = self.create_user("+257770000023", "driver", "Livreur Stats")
        product = self.create_product(farmer.id, quantity=25)

        self.main.update_admin_settings(
            self.schemas.PlatformSettingsUpdate(commission_rate=0.10),
            db=self.db,
        )

        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=4), buyer_id=buyer.id, db=self.db)
        collected = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)
        self.main.pickup_order(collected.id, collected.pickup_qr_token, driver.id, db=self.db)

        stats = self.main.get_farmer_stats(farmer.id, db=self.db)

        self.assertAlmostEqual(stats["balance"], 3600.0)
        self.assertAlmostEqual(stats["total_sales_bif"], 4000.0)
        self.assertEqual(stats["order_count"], 3)
        self.assertAlmostEqual(stats["pending_payout"], 900.0)
        self.assertEqual(len(stats["weekly_sales"]), 4)
        self.assertAlmostEqual(stats["weekly_sales"][-1]["amount"], 4000.0)

        with self.assertRaises(HTTPException) as ctx:
            self.main.get_farmer_stats(999999, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_buyer_orders_return_latest_first_with_driver_codes_and_items(self):
        farmer = self.create_user("+257770000031", "farmer", "Fermier Buyer", province="Ngozi")
        buyer = self.create_user("+257770000032", "buyer", "Acheteur Buyer", province="Bujumbura")
        driver = self.create_user("+257770000033", "driver", "Livreur Buyer", province="Gitega")
        product = self.create_product(farmer.id, name="Riz", quantity=20, price=2200, province="Ngozi")

        first_order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        second_order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=3), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(second_order.id, second_order.pickup_qr_token, driver.id, db=self.db)

        orders = self.main.get_buyer_orders(buyer.id, db=self.db)

        self.assertEqual([item["id"] for item in orders], [second_order.id, first_order.id])
        self.assertEqual(orders[0]["status"], "collected")
        self.assertEqual(orders[0]["driver"]["name"], driver.name)
        self.assertEqual(orders[0]["pickup_qr"], second_order.pickup_qr_token)
        self.assertEqual(orders[0]["delivery_otp"], second_order.delivery_otp)
        self.assertEqual(orders[0]["items"][0]["name"], product.name)
        self.assertEqual(orders[0]["items"][0]["qty"], 3)
        self.assertEqual(orders[1]["status"], "pending")


if __name__ == "__main__":
    unittest.main()