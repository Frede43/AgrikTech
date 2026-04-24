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


class UserDashboardAndDeliveryEdgeCaseTests(unittest.TestCase):
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

    def create_user(self, phone: str, role: str, name: str, province: str = "Bujumbura", **extra):
        payload = {"phone_number": phone, "role": role, "name": name, "province": province, **extra}
        return self.main.create_user(self.schemas.UserCreate(**payload), db=self.db)

    def create_product(self, farmer_id: int, name: str, quantity: float, price: float = 1000, province: str = "Ngozi"):
        return self.main.create_product(
            self.schemas.ProductCreate(name=name, category="legumes", price_per_kg=price, unit="kg", quantity_kg=quantity, province=province),
            farmer_id=farmer_id,
            db=self.db,
        )

    def test_read_user_returns_user_and_missing_user_404(self):
        user = self.create_user(
            "+257780000001",
            "buyer",
            "Acheteur Profil",
            province="Ngozi",
            address="Quartier Industriel",
            commune="Mukaza",
            latitude=-3.3822,
            longitude=29.3644,
        )

        found = self.main.read_user(user.id, db=self.db)

        self.assertEqual(found.id, user.id)
        self.assertEqual(found.role, "acheteur")
        self.assertEqual(found.province, "Ngozi")
        self.assertEqual(found.address, "Quartier Industriel")
        self.assertEqual(found.commune, "Mukaza")
        self.assertAlmostEqual(found.latitude, -3.3822)
        self.assertAlmostEqual(found.longitude, 29.3644)
        with self.assertRaises(HTTPException) as ctx:
            self.main.read_user(999999, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_update_user_persists_location_fields_and_order_detail_uses_them(self):
        farmer = self.create_user(
            "+257780000031",
            "farmer",
            "Fermier Coord",
            province="Kayanza",
            address="Colline Kibira",
            commune="Kabarore",
            latitude=-2.922,
            longitude=29.624,
        )
        buyer = self.create_user("+257780000032", "buyer", "Acheteur Coord", province="Bujumbura")
        driver = self.create_user("+257780000033", "driver", "Livreur Coord", province="Bujumbura")
        product = self.create_product(farmer.id, "Pommes de terre", quantity=40, price=1300, province="Kayanza")

        updated_buyer = self.main.update_user(
            buyer.id,
            self.schemas.UserUpdate(
                address="Avenue du Large",
                commune="Rohero",
                latitude=-3.3815,
                longitude=29.3611,
            ),
            db=self.db,
        )
        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=3), buyer_id=buyer.id, db=self.db)
        logistics = self.main.get_logistics_orders(db=self.db)
        detail = self.main.get_order_detail(order.id, db=self.db)

        self.assertEqual(updated_buyer.commune, "Rohero")
        self.assertEqual(logistics[0]["address"], "Colline Kibira, Kabarore, Kayanza")
        self.assertEqual(logistics[0]["buyer_address"], "Avenue du Large, Rohero, Bujumbura")
        self.assertNotEqual(logistics[0]["distance"], "À confirmer")
        self.assertEqual(detail["farmer"]["coordinates"], "-2.92200, 29.62400")
        self.assertEqual(detail["buyer"]["coordinates"], "-3.38150, 29.36110")
        self.assertIn("Avenue du Large", detail["instructions"])

    def test_update_user_can_toggle_is_active_for_non_admin_only(self):
        buyer = self.create_user("+257780000041", "buyer", "Acheteur Actif")
        admin = self.create_user("+257780000042", "admin", "Admin Protégé")

        updated_buyer = self.main.update_user(
            buyer.id,
            self.schemas.UserUpdate(is_active=False),
            db=self.db,
        )

        self.assertFalse(updated_buyer.is_active)

        with self.assertRaises(HTTPException) as ctx:
            self.main.update_user(
                admin.id,
                self.schemas.UserUpdate(is_active=False),
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertTrue(self.main.read_user(admin.id, db=self.db).is_active)

    def test_update_user_can_change_phone_and_role_for_non_admin(self):
        buyer = self.create_user("+257780000043", "buyer", "Acheteur Éditable", province="Gitega")
        self.create_user("+257780000044", "farmer", "Fermier Déjà Pris")

        updated = self.main.update_user(
            buyer.id,
            self.schemas.UserUpdate(
                name="Livreur Réaffecté",
                phone_number="+257780000045",
                role="driver",
                province="Muyinga",
            ),
            db=self.db,
        )

        self.assertEqual(updated.name, "Livreur Réaffecté")
        self.assertEqual(updated.phone_number, "+257780000045")
        self.assertEqual(updated.role, "logistique")
        self.assertEqual(updated.province, "Muyinga")

        with self.assertRaises(HTTPException) as ctx:
            self.main.update_user(
                buyer.id,
                self.schemas.UserUpdate(phone_number="+257780000044"),
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    def test_delete_user_removes_free_user_and_blocks_protected_or_linked_accounts(self):
        free_user = self.create_user("+257780000061", "buyer", "Acheteur Supprimable")

        self.main.delete_user(free_user.id, db=self.db)

        with self.assertRaises(HTTPException) as missing_ctx:
            self.main.read_user(free_user.id, db=self.db)
        self.assertEqual(missing_ctx.exception.status_code, 404)

        admin = self.create_user("+257780000062", "admin", "Admin Verrouillé")
        with self.assertRaises(HTTPException) as admin_ctx:
            self.main.delete_user(admin.id, db=self.db)
        self.assertEqual(admin_ctx.exception.status_code, 400)

        farmer = self.create_user("+257780000063", "farmer", "Fermier Lié", province="Ngozi")
        buyer = self.create_user("+257780000064", "buyer", "Acheteur Lié")
        product = self.create_product(farmer.id, "Choux", quantity=12, price=800, province="Ngozi")
        self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)

        with self.assertRaises(HTTPException) as linked_ctx:
            self.main.delete_user(farmer.id, db=self.db)

        self.assertEqual(linked_ctx.exception.status_code, 400)
        self.assertEqual(self.main.read_user(farmer.id, db=self.db).id, farmer.id)

    def test_get_users_returns_activity_metrics_for_admin_screen(self):
        farmer = self.create_user("+257780000051", "farmer", "Fermier Activité", province="Ngozi")
        buyer = self.create_user("+257780000052", "buyer", "Acheteur Activité")
        driver = self.create_user("+257780000053", "driver", "Livreur Activité")
        admin = self.create_user("+257780000054", "admin", "Admin Activité")
        product = self.create_product(farmer.id, "Maïs", quantity=30, price=1500, province="Ngozi")

        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(order.id, order.delivery_otp, db=self.db)

        users = self.main.get_users(db=self.db)
        by_id = {user["id"]: user for user in users}

        self.assertEqual(by_id[buyer.id]["orders"], 1)
        self.assertAlmostEqual(by_id[buyer.id]["gmv"], 3000.0)
        self.assertEqual(by_id[farmer.id]["orders"], 1)
        self.assertAlmostEqual(by_id[farmer.id]["gmv"], 3000.0)
        self.assertEqual(by_id[driver.id]["orders"], 1)
        self.assertAlmostEqual(by_id[driver.id]["gmv"], 0.0)
        self.assertEqual(by_id[admin.id]["orders"], 0)
        self.assertAlmostEqual(by_id[admin.id]["gmv"], 0.0)

    def test_farmer_dashboard_maps_statuses_and_counts_products(self):
        farmer = self.create_user("+257780000011", "farmer", "Fermier Dashboard", province="Kayanza")
        buyer = self.create_user("+257780000012", "buyer", "Acheteur Dashboard")
        driver = self.create_user("+257780000013", "driver", "Livreur Dashboard")
        active_product = self.create_product(farmer.id, "Tomates", quantity=20, price=1200, province="Kayanza")
        self.create_product(farmer.id, "Oignons", quantity=0, price=900, province="Kayanza")

        pending = self.main.create_order(self.schemas.OrderCreate(product_id=active_product.id, quantity=2), buyer_id=buyer.id, db=self.db)
        collected = self.main.create_order(self.schemas.OrderCreate(product_id=active_product.id, quantity=3), buyer_id=buyer.id, db=self.db)
        delivered = self.main.create_order(self.schemas.OrderCreate(product_id=active_product.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(collected.id, collected.pickup_qr_token, driver.id, db=self.db)
        self.main.pickup_order(delivered.id, delivered.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(delivered.id, delivered.delivery_otp, db=self.db)
        collected_row = self.db.query(self.models.Order).filter_by(id=collected.id).first()
        collected_row.status = "TRANSIT"
        pending.created_at = datetime(2024, 1, 1, 8, 0, 0)
        collected_row.created_at = datetime(2024, 1, 2, 8, 0, 0)
        self.db.commit()

        dashboard = self.main.get_farmer_dashboard(farmer.id, db=self.db)

        self.assertEqual(dashboard["user"]["name"], farmer.name)
        self.assertAlmostEqual(dashboard["stats"]["revenue"], 1200.0)
        self.assertEqual(dashboard["stats"]["pending_orders"], 2)
        self.assertEqual(dashboard["stats"]["active_products"], 1)
        self.assertEqual(dashboard["stats"]["total_products"], 2)
        self.assertEqual([o["status"] for o in dashboard["recent_orders"]], ["transit", "preparation"])
        self.assertEqual(dashboard["recent_orders"][0]["buyer"], buyer.name)
        self.assertEqual(dashboard["weekly_sales"][-1]["amount"], 1200.0)

    def test_pickup_and_delivery_reject_wrong_states_and_roles(self):
        farmer = self.create_user("+257780000021", "farmer", "Fermier Garde")
        buyer = self.create_user("+257780000022", "buyer", "Acheteur Garde")
        fake_driver = self.create_user("+257780000023", "buyer", "Faux Livreur")
        real_driver = self.create_user("+257780000024", "driver", "Vrai Livreur")
        product = self.create_product(farmer.id, "Haricots", quantity=15)
        order = self.main.create_order(self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db)

        with self.assertRaises(HTTPException) as pickup_role_error:
            self.main.pickup_order(order.id, order.pickup_qr_token, fake_driver.id, db=self.db)
        self.assertEqual(pickup_role_error.exception.status_code, 400)
        with self.assertRaises(HTTPException) as delivery_state_error:
            self.main.deliver_order(order.id, order.delivery_otp, db=self.db)
        self.assertEqual(delivery_state_error.exception.status_code, 400)

        pickup = self.main.pickup_order(order.id, order.pickup_qr_token, real_driver.id, db=self.db)
        self.assertEqual(pickup["status"], self.main.ORDER_STATUS_PICKED_UP)
        with self.assertRaises(HTTPException) as second_pickup_error:
            self.main.pickup_order(order.id, order.pickup_qr_token, real_driver.id, db=self.db)
        self.assertEqual(second_pickup_error.exception.status_code, 400)

        self.main.deliver_order(order.id, order.delivery_otp, db=self.db)
        with self.assertRaises(HTTPException) as second_delivery_error:
            self.main.deliver_order(order.id, order.delivery_otp, db=self.db)
        self.assertEqual(second_delivery_error.exception.status_code, 400)
        self.assertEqual(self.db.query(self.models.TransactionLog).count(), 1)


if __name__ == "__main__":
    unittest.main()