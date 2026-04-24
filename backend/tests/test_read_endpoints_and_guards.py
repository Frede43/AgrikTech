import importlib
import os
import sys
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class RequestStub:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class ResponseStub:
    def __init__(self):
        self.cookies_set = {}

    def set_cookie(self, key, value="", **kwargs):
        self.cookies_set[key] = {"value": value, **kwargs}


class ReadEndpointsAndGuardsTests(unittest.TestCase):
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

    def create_product(self, farmer_id: int, name: str, category: str, province: str, quantity: float = 10, price: float = 1000):
        return self.main.create_product(
            self.schemas.ProductCreate(name=name, category=category, price_per_kg=price, unit="kg", quantity_kg=quantity, province=province),
            farmer_id=farmer_id,
            db=self.db,
        )

    def authenticated_request(self, user):
        response = ResponseStub()
        self.main.set_authenticated_session(response, user)
        session_token = response.cookies_set[self.main.SESSION_COOKIE_NAME]["value"]
        return RequestStub({self.main.SESSION_COOKIE_NAME: session_token})

    def test_guard_rails_on_user_product_and_order_creation(self):
        buyer = self.create_user("+257760000001", "buyer", "Acheteur Garde")
        farmer = self.create_user("+257760000002", "farmer", "Fermier Garde")

        with self.assertRaises(HTTPException):
            self.create_user("+257760000003", "unknown", "Role Invalide")
        with self.assertRaises(HTTPException):
            self.create_product(buyer.id, "Tomates", "legumes", "Kayanza")

        product = self.create_product(farmer.id, "Tomates", "legumes", "Kayanza", quantity=3, price=2000)
        with self.assertRaises(HTTPException):
            self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=5), buyer_id=buyer.id, db=self.db)
        with self.assertRaises(HTTPException):
            self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=farmer.id, db=self.db)

    def test_read_products_categories_users_and_notifications(self):
        farmer = self.create_user("+257760000011", "farmer", "Fermier Lecture", province="Ngozi")
        buyer = self.create_user("+257760000012", "buyer", "Acheteur Lecture", province="Bujumbura")
        driver = self.create_user("+257760000013", "driver", "Livreur Lecture", province="Gitega")
        self.create_product(farmer.id, "Tomates", "legumes", "Ngozi")
        bananas = self.create_product(farmer.id, "Bananes", "fruits", "Kirundo")
        self.main.create_order(self.schemas.OrderCreate(product_id=bananas.id, quantity=1), buyer_id=buyer.id, db=self.db)

        legumes = self.main.read_products(category="legumes", db=self.db)
        ngozi_products = self.main.read_products(province="Ngozi", db=self.db)
        farmer_products = self.main.read_products(farmer_id=farmer.id, db=self.db)
        categories = self.main.get_categories(db=self.db)
        users = self.main.get_users(db=self.db)
        notifications = self.main.get_notifications(buyer.id, request=self.authenticated_request(buyer), db=self.db)

        self.assertEqual(len(legumes), 1)
        self.assertEqual(legumes[0].name, "Tomates")
        self.assertEqual(len(ngozi_products), 1)
        self.assertEqual(len(farmer_products), 2)
        self.assertEqual({c["id"] for c in categories}, {"legumes", "fruits"})
        self.assertEqual(len(users), 3)
        self.assertIsInstance(users[0], dict)
        self.assertTrue({"id", "name", "role", "orders", "gmv", "is_active"}.issubset(users[0].keys()))
        self.assertEqual(driver.role, "logistique")
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["type"], "order")
        self.assertIn("title", notifications[0])
        self.assertIn("body", notifications[0])
        self.assertIn("time", notifications[0])

    def test_logistics_and_public_data_endpoints_return_expected_shapes(self):
        farmer = self.create_user("+257760000021", "farmer", "Fermier Log", province="Gitega")
        buyer = self.create_user("+257760000022", "buyer", "Acheteur Log", province="Bujumbura")
        driver = self.create_user("+257760000023", "driver", "Livreur Log", province="Ngozi")
        product = self.create_product(farmer.id, "Pommes", "fruits", "Gitega", quantity=20, price=1500)

        pending = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        collected = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(collected.id, collected.pickup_qr_token, driver.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)

        logistics_default = self.main.get_logistics_orders(db=self.db)
        logistics_collected = self.main.get_logistics_orders(status="collected", db=self.db)
        prices = self.main.get_live_prices(db=self.db)
        weather = self.main.get_weather()
        tips = self.main.get_agri_tips()

        self.assertEqual({o["status"] for o in logistics_default}, {"pending", "collected"})
        self.assertNotIn(delivered.id, {o["id"] for o in logistics_default})
        self.assertEqual([o["id"] for o in logistics_collected], [collected.id])
        self.assertEqual(pending.status, self.main.ORDER_STATUS_PAID_ESCROW)
        self.assertEqual(collected.status, self.main.ORDER_STATUS_PICKED_UP)
        self.assertEqual(delivered.status, self.main.ORDER_STATUS_COMPLETED)
        self.assertIn("product", prices[0])
        self.assertIn("price", prices[0])
        self.assertIn("confidence_score", prices[0])
        self.assertIn("confidence_label", prices[0])
        self.assertIn("recommended_action", prices[0])
        self.assertEqual(weather["location"], "Province de Kayanza")
        self.assertEqual(len(weather["forecast"]), 5)
        self.assertIn(tips[0]["urgency"], {"high", "medium", "low"})

    def test_driver_notifications_cover_pickup_delivery_and_system_states(self):
        farmer = self.create_user("+257760000024", "farmer", "Fermier Notif", province="Ngozi")
        buyer = self.create_user("+257760000025", "buyer", "Acheteur Notif", province="Bujumbura")
        driver = self.create_user("+257760000026", "driver", "Livreur Notif", province="Gitega")
        product = self.create_product(farmer.id, "Ananas", "fruits", "Ngozi", quantity=20, price=1800)

        self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        collected = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(collected.id, collected.pickup_qr_token, driver.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)

        notifications = self.main.get_notifications(driver.id, request=self.authenticated_request(driver), db=self.db)

        self.assertTrue({"pickup", "delivery", "system"}.issubset({item["type"] for item in notifications}))
        self.assertGreaterEqual(len(notifications), 3)
        for item in notifications:
            self.assertIn("title", item)
            self.assertIn("body", item)
            self.assertIn("time", item)
            self.assertIn("read", item)

    def test_buyer_notifications_can_be_persistently_dismissed(self):
        farmer = self.create_user("+257760000027", "farmer", "Fermier Dismiss", province="Ngozi")
        buyer = self.create_user("+257760000028", "buyer", "Acheteur Dismiss", province="Bujumbura")
        product = self.create_product(farmer.id, "Mangues", "fruits", "Ngozi", quantity=20, price=1800)

        self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)

        request = self.authenticated_request(buyer)
        notifications = self.main.get_notifications(buyer.id, request=request, db=self.db)
        self.assertEqual(len(notifications), 1)

        self.db.add(
            self.models.NotificationDismissal(
                user_id=buyer.id,
                notification_id=notifications[0]["id"],
            )
        )
        self.db.commit()

        filtered_notifications = self.main.get_notifications(buyer.id, request=request, db=self.db)
        self.assertEqual(filtered_notifications, [])

    def test_live_prices_are_derived_from_real_market_data(self):
        farmer = self.create_user("+257760000031", "farmer", "Fermier Marché", province="Kayanza")
        buyer = self.create_user("+257760000032", "buyer", "Acheteur Marché", province="Bujumbura")
        driver = self.create_user("+257760000033", "driver", "Livreur Marché", province="Ngozi")

        old_product = self.create_product(farmer.id, "Tomates", "legumes", "Kayanza", quantity=2, price=2000)
        old_order = self.main.create_order(self.schemas.OrderCreate(product_id=old_product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(old_order.id, old_order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(old_order.id, old_order.delivery_otp, db=self.db)
        old_order.created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=14)

        current_product = self.create_product(farmer.id, "Tomates", "legumes", "Kayanza", quantity=10, price=2600)
        current_product.harvested_at = datetime.now(UTC).replace(tzinfo=None)
        self.db.commit()

        prices = self.main.get_live_prices(db=self.db)
        tomatoes = next(item for item in prices if item["product"] == "Tomates")

        self.assertEqual(tomatoes["price"], 2600.0)
        self.assertEqual(tomatoes["trend"], "up")
        self.assertEqual(tomatoes["change"], 30.0)
        self.assertEqual(tomatoes["active_listings"], 1)
        self.assertGreaterEqual(tomatoes["sample_size"], 2)
        self.assertGreaterEqual(tomatoes["confidence_score"], 20)
        self.assertIn(tomatoes["confidence_label"], {"low", "medium", "high"})
        self.assertEqual(tomatoes["volatility"], "high")
        self.assertEqual(tomatoes["recommended_action"], "sell")
        self.assertEqual(tomatoes["pricing_basis"], "active_listings")
        self.assertEqual(tomatoes["source"], "marketplace")
        self.assertEqual(tomatoes["market_scope"], "national")
        self.assertEqual(tomatoes["market_scope_label"], "Burundi")

    def test_live_prices_can_be_scoped_to_a_province(self):
        farmer_kayanza = self.create_user("+257760000051", "farmer", "Fermier Kayanza", province="Kayanza")
        farmer_ngozi = self.create_user("+257760000052", "farmer", "Fermier Ngozi", province="Ngozi")
        buyer = self.create_user("+257760000053", "buyer", "Acheteur Scope", province="Bujumbura")
        driver = self.create_user("+257760000054", "driver", "Livreur Scope", province="Ngozi")

        old_product = self.create_product(farmer_kayanza.id, "Tomates", "legumes", "Kayanza", quantity=2, price=2000)
        old_order = self.main.create_order(self.schemas.OrderCreate(product_id=old_product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(old_order.id, old_order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(old_order.id, old_order.delivery_otp, db=self.db)
        old_order.created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=14)

        current_kayanza = self.create_product(farmer_kayanza.id, "Tomates", "legumes", "Kayanza", quantity=10, price=2600)
        current_kayanza.harvested_at = datetime.now(UTC).replace(tzinfo=None)
        current_ngozi = self.create_product(farmer_ngozi.id, "Tomates", "legumes", "Ngozi", quantity=5, price=3200)
        current_ngozi.harvested_at = datetime.now(UTC).replace(tzinfo=None)
        self.db.commit()

        national_prices = self.main.get_live_prices(db=self.db)
        kayanza_prices = self.main.get_live_prices(province=" kayanza ", db=self.db)

        national_tomatoes = next(item for item in national_prices if item["product"] == "Tomates")
        kayanza_tomatoes = next(item for item in kayanza_prices if item["product"] == "Tomates")

        self.assertEqual(national_tomatoes["price"], 2800.0)
        self.assertEqual(national_tomatoes["active_listings"], 2)
        self.assertEqual(national_tomatoes["provinces"], 2)
        self.assertEqual(national_tomatoes["market_scope"], "national")
        self.assertEqual(national_tomatoes["market_scope_label"], "Burundi")

        self.assertEqual(kayanza_tomatoes["price"], 2600.0)
        self.assertEqual(kayanza_tomatoes["active_listings"], 1)
        self.assertEqual(kayanza_tomatoes["provinces"], 1)
        self.assertEqual(kayanza_tomatoes["market_scope"], "province")
        self.assertEqual(kayanza_tomatoes["market_scope_label"], "Kayanza")

    def test_cart_validation_and_admin_notifications_expose_expected_contracts(self):
        admin = self.create_user("+257760000041", "admin", "Admin Contrats", province="Bujumbura")
        farmer = self.create_user("+257760000042", "farmer", "Fermier Contrats", province="Ngozi")
        buyer = self.create_user("+257760000043", "buyer", "Acheteur Contrats", province="Bujumbura")
        driver = self.create_user("+257760000044", "driver", "Livreur Contrats", province="Gitega")
        product = self.create_product(farmer.id, "Haricots", "legumes", "Ngozi", quantity=2, price=1500)

        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(order.id, order.delivery_otp, db=self.db)
        self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=order.id,
                reason="Produit abîmé",
                detail="Sac percé à la réception.",
                refund_requested=1200,
                priority="high",
            ),
            db=self.db,
        )
        disputed_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        product.quantity_kg = 1
        self.db.commit()

        validation = self.main.validate_cart(
            self.schemas.CartValidationRequest(
                items=[
                    self.schemas.CartValidationItem(
                        productId=product.id,
                        name=product.name,
                        price=1400,
                        quantity=3,
                        unit="kg",
                        image_url=product.image_url,
                        category=product.category,
                    )
                ]
            ),
            db=self.db,
        )
        notifications = self.main.get_notifications(admin.id, request=self.authenticated_request(admin), db=self.db)

        self.assertFalse(validation["valid"])
        self.assertEqual(validation["items"][0]["status"], "stock_changed")
        self.assertEqual(validation["items"][0]["validated_quantity"], 1)
        self.assertAlmostEqual(validation["available_total"], 1500.0)
        self.assertIn("Le prix a changé", validation["items"][0]["issues"])
        self.assertEqual(disputed_order.status, self.main.ORDER_STATUS_DISPUTED)
        self.assertEqual(self.main.get_order_detail(order.id, db=self.db)["status"], "disputed")
        self.assertTrue({"dispute", "stock", "payout", "system"}.issubset({item["type"] for item in notifications}))

        self.main.reject_dispute(1, db=self.db)
        restored_order = self.db.query(self.models.Order).filter_by(id=order.id).first()
        self.assertEqual(restored_order.status, self.main.ORDER_STATUS_COMPLETED)


if __name__ == "__main__":
    unittest.main()

