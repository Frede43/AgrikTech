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


class GuardrailRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        os.environ["DATABASE_URL"] = f"sqlite:///{Path(cls._tmpdir.name) / 'test.db'}"
        os.chdir(BACKEND_DIR)
        for name in list(sys.modules):
            if name == "backend" or name.startswith("backend.") or name in ("main", "models", "schemas", "database", "utils", "config"):
                sys.modules.pop(name, None)
        cls.database = importlib.import_module("backend.database")
        cls.models = importlib.import_module("backend.models")
        cls.schemas = importlib.import_module("backend.schemas")
        cls.main = importlib.import_module("backend.main")

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

    def create_product(self, farmer_id: int, quantity: float, price: float = 2000, province: str = "Gitega"):
        return self.main.create_product(
            self.schemas.ProductCreate(
                name="Haricots",
                category="cereales",
                price_per_kg=price,
                unit="kg",
                quantity_kg=quantity,
                province=province,
            ),
            farmer_id=farmer_id,
            db=self.db,
        )

    def test_failed_delivery_otp_keeps_order_collected_and_preserves_funds(self):
        farmer = self.create_user("+257781000001", "farmer", "Fermier OTP", province="Ngozi")
        buyer = self.create_user("+257781000002", "buyer", "Acheteur OTP")
        driver = self.create_user("+257781000003", "driver", "Livreur OTP")
        product = self.create_product(farmer.id, quantity=8, price=2500, province="Ngozi")
        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)

        with self.assertRaises(HTTPException) as ctx:
            self.main.deliver_order(order.id, "0000", db=self.db)

        refreshed_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        refreshed_farmer = self.db.query(self.models.User).filter_by(id=farmer.id).first()

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(refreshed_order.status, self.main.ORDER_STATUS_PICKED_UP)
        self.assertAlmostEqual(refreshed_farmer.balance, 0.0)
        self.assertEqual(self.db.query(self.models.TransactionLog).count(), 0)

    def test_exact_stock_order_depletes_inventory_and_next_order_fails(self):
        farmer = self.create_user("+257781000011", "farmer", "Fermier Stock")
        buyer = self.create_user("+257781000012", "buyer", "Acheteur Stock")
        product = self.create_product(farmer.id, quantity=5, price=1800)

        self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=5), buyer_id=buyer.id, db=self.db)
        refreshed_product = self.db.query(self.models.Product).filter_by(id=product.id).first()

        with self.assertRaises(HTTPException) as ctx:
            self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)

        self.assertEqual(refreshed_product.quantity_kg, 0)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Stock insuffisant", ctx.exception.detail)

    def test_admin_stats_province_pending_counts_ignore_delivered_orders(self):
        farmer = self.create_user("+257781000021", "farmer", "Fermier Admin", province="Kayanza")
        buyer = self.create_user("+257781000022", "buyer", "Acheteur Admin")
        driver = self.create_user("+257781000023", "driver", "Livreur Admin")
        product = self.create_product(farmer.id, quantity=12, price=2200, province="Kayanza")

        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        pending = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)

        stats = self.main.get_admin_stats(db=self.db)
        province_entry = next(item for item in stats["province_data"] if item["province"] == "Kayanza")

        self.assertEqual(stats["active_orders"], 1)
        self.assertEqual(province_entry["orders_pending"], 1)
        self.assertEqual(pending.status, self.main.ORDER_STATUS_PAID_ESCROW)


if __name__ == "__main__":
    unittest.main()