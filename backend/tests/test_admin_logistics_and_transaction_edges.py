import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class AdminLogisticsAndTransactionEdgeTests(unittest.TestCase):
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

    def create_user(self, phone: str, role: str, name: str, province: str = "Bujumbura"):
        return self.main.create_user(self.schemas.UserCreate(phone_number=phone, role=role, name=name, province=province), db=self.db)

    def create_product(self, farmer_id: int, name: str, price: float, province: str):
        return self.main.create_product(
            self.schemas.ProductCreate(name=name, category="legumes", price_per_kg=price, unit="kg", quantity_kg=20, province=province),
            farmer_id=farmer_id,
            db=self.db,
        )

    def test_admin_stats_group_provinces_and_count_only_active_orders(self):
        farmer_ngozi = self.create_user("+257701000001", "farmer", "Fermier Ngozi", province="Ngozi")
        farmer_kirundo = self.create_user("+257701000002", "farmer", "Fermier Kirundo", province="Kirundo")
        buyer = self.create_user("+257701000003", "buyer", "Acheteur Admin", province="Bujumbura")
        driver = self.create_user("+257701000004", "driver", "Livreur Admin", province="Gitega")
        legacy_farmer = self.models.User(phone_number="+257701000005", role="farmer", name="Legacy Ngozi", province="Ngozi", balance=0, is_active=True)
        self.db.add(legacy_farmer)
        self.db.commit()
        self.db.refresh(legacy_farmer)

        product_ngozi = self.create_product(farmer_ngozi.id, "Tomates", 2000, "Ngozi")
        product_legacy = self.create_product(legacy_farmer.id, "Haricots", 1500, "Ngozi")
        product_kirundo = self.create_product(farmer_kirundo.id, "Maïs", 1000, "Kirundo")
        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product_ngozi.id, quantity=1), buyer_id=buyer.id, db=self.db)
        collected = self.main.create_order(self.schemas.OrderCreate(product_id=product_legacy.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.create_order(self.schemas.OrderCreate(product_id=product_kirundo.id, quantity=3), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)
        self.main.pickup_order(collected.id, collected.pickup_qr_token, driver.id, db=self.db)

        stats = self.main.get_admin_stats(db=self.db)
        provinces = {item["province"]: item for item in stats["province_data"]}

        self.assertAlmostEqual(stats["gmv"], 8000.0)
        self.assertEqual(stats["active_farmers"], 3)
        self.assertEqual(stats["active_orders"], 2)
        self.assertEqual(provinces["Ngozi"]["farmers"], 2)
        self.assertAlmostEqual(provinces["Ngozi"]["stock_tons"], 3.0)
        self.assertEqual(provinces["Ngozi"]["orders_pending"], 1)
        self.assertEqual(provinces["Kirundo"]["orders_pending"], 1)

    def test_logistics_orders_delivered_filter_returns_full_payload(self):
        farmer = self.create_user("+257701000011", "farmer", "Fermier Log", province="Ngozi")
        buyer = self.create_user("+257701000012", "buyer", "Acheteur Log", province="Bujumbura")
        driver = self.create_user("+257701000013", "driver", "Livreur Log", province="Gitega")
        product = self.create_product(farmer.id, "Pommes de terre", 1800, "Ngozi")
        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(order.id, order.delivery_otp, db=self.db)

        logistics = self.main.get_logistics_orders(status="delivered", db=self.db)

        self.assertEqual([item["id"] for item in logistics], [order.id])
        self.assertEqual(logistics[0]["status"], "delivered")
        self.assertEqual(logistics[0]["farmer"], farmer.name)
        self.assertEqual(logistics[0]["buyer"], buyer.name)
        self.assertEqual(logistics[0]["address"], farmer.province)
        self.assertEqual(logistics[0]["buyer_address"], buyer.province)
        self.assertEqual(logistics[0]["pickup_qr"], order.pickup_qr_token)
        self.assertEqual(logistics[0]["delivery_otp"], order.delivery_otp)

    def test_user_transactions_handle_payout_entries_without_order(self):
        farmer = self.create_user("+257701000021", "farmer", "Fermier Wallet")
        self.db.add(self.models.TransactionLog(order_id=None, user_id=farmer.id, action="WITHDRAWAL_REQUEST", amount=-2500))
        self.db.commit()

        txns = self.main.get_user_transactions(farmer.id, db=self.db)

        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0]["type"], "payout")
        self.assertEqual(txns[0]["status"], "completed")
        self.assertEqual(txns[0]["buyer"], "Retrait Lumicash")
        self.assertEqual(txns[0]["items"], f"Vers {farmer.phone_number}")
        self.assertEqual(txns[0]["gross"], 2500)
        self.assertEqual(txns[0]["commission"], 0)
        self.assertEqual(txns[0]["net"], -2500)


if __name__ == "__main__":
    unittest.main()