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


class RequestStub:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class ProductsAdminAndDashboardEdgeTests(unittest.TestCase):
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
        cls.utils = importlib.import_module("backend.utils")
        cls.config = importlib.import_module("backend.config")
        cls.products_router = importlib.import_module("backend.routers.products")
        cls.models.Base.metadata.create_all(bind=cls.database.engine)

    @classmethod
    def tearDownClass(cls):
        cls.database.engine.dispose()
        cls._tmpdir.cleanup()

    def setUp(self):
        self.db = self.database.SessionLocal()
        for table in reversed(self.models.Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def create_user(self, phone: str, role: str, name: str, province: str = "Bujumbura"):
        return self.main.create_user(self.schemas.UserCreate(phone_number=phone, role=role, name=name, province=province), db=self.db)

    def create_product(self, farmer_id: int, name: str, category: str, province: str):
        return self.main.create_product(
            self.schemas.ProductCreate(name=name, category=category, price_per_kg=1000, unit="kg", quantity_kg=10, province=province),
            farmer_id=farmer_id,
            db=self.db,
        )

    def authenticated_router_request(self, user):
        """Session réelle persistée en base, pour appeler directement une
        fonction de ROUTEUR réel (backend/routers/*.py), qui authentifie via
        utils.get_authenticated_user + PersistentSession — voir le même
        helper (et sa justification détaillée) dans
        test_supporting_endpoints.py."""
        from fastapi import Response as FastAPIResponse

        self.utils.set_authenticated_session(FastAPIResponse(), user, self.db)
        session = (
            self.db.query(self.models.PersistentSession)
            .filter(self.models.PersistentSession.user_id == user.id)
            .order_by(self.models.PersistentSession.expires_at.desc())
            .first()
        )
        assert session is not None
        return RequestStub(cookies={self.config.SESSION_COOKIE_NAME: session.id})

    def test_get_product_returns_farmer_relation_and_missing_product_404(self):
        farmer = self.create_user("+257790000001", "farmer", "Fermier Produit", province="Ngozi")
        product = self.create_product(farmer.id, "Tomates", "legumes", "Ngozi")

        found = self.main.get_product(product.id, db=self.db)

        self.assertEqual(found.id, product.id)
        self.assertEqual(found.farmer_id, farmer.id)
        self.assertEqual(found.farmer.name, farmer.name)
        self.assertEqual(found.farmer_name, farmer.name)
        with self.assertRaises(HTTPException) as ctx:
            self.main.get_product(999999, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_read_products_supports_filters_and_simple_pagination(self):
        farmer_one = self.create_user("+257790000011", "farmer", "Fermier Un", province="Ngozi")
        farmer_two = self.create_user("+257790000012", "farmer", "Fermier Deux", province="Gitega")
        self.create_product(farmer_one.id, "Tomates", "legumes", "Ngozi")
        self.create_product(farmer_one.id, "Bananes", "fruits", "Ngozi")
        self.create_product(farmer_two.id, "Maïs", "cereales", "Gitega")
        self.create_product(farmer_two.id, "Haricots", "legumes", "Ngozi")

        first_page = self.main.read_products(limit=2, db=self.db)
        second_page = self.main.read_products(skip=2, limit=2, db=self.db)
        filtered = self.main.read_products(category="legumes", province="Ngozi", farmer_id=farmer_two.id, db=self.db)

        self.assertEqual(len(first_page), 2)
        self.assertEqual(len(second_page), 2)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].name, "Haricots")
        self.assertEqual(filtered[0].farmer_id, farmer_two.id)

    def test_admin_stats_empty_state_excludes_non_farmers(self):
        self.create_user("+257790000021", "buyer", "Acheteur Admin", province="Bujumbura")
        self.create_user("+257790000022", "driver", "Livreur Admin", province="Ngozi")
        self.create_user("+257790000023", "admin", "Admin Plateforme", province="Gitega")

        stats = self.main.get_admin_stats(db=self.db)

        self.assertEqual(stats["gmv"], 0)
        self.assertEqual(stats["active_farmers"], 0)
        self.assertEqual(stats["active_orders"], 0)
        self.assertEqual(stats["total_payouts"], 0)
        self.assertAlmostEqual(stats["commission_rate"], self.main.DEFAULT_COMMISSION_RATE)
        self.assertEqual(stats["payout_beneficiaries"], 0)
        self.assertEqual(stats["payout_releases"], 0)
        self.assertEqual(stats["kpi_growth"], {
            "gmv": 0.0,
            "active_farmers": 0.0,
            "active_orders": 0.0,
            "total_payouts": 0.0,
        })
        self.assertEqual(stats["province_data"], [])

    def test_farmer_dashboard_missing_user_returns_404(self):
        with self.assertRaises(HTTPException) as ctx:
            self.main.get_farmer_dashboard(999999, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_update_product_persists_changes_and_delete_product_removes_row(self):
        farmer = self.create_user("+257790000031", "farmer", "Fermier CRUD", province="Ngozi")
        product = self.create_product(farmer.id, "Tomates", "legumes", "Ngozi")

        updated = self.main.update_product(
            product.id,
            self.schemas.ProductUpdate(name="Tomates Bio", quantity_kg=25, min_stock=8, province="Kayanza"),
            farmer_id=farmer.id,
            db=self.db,
        )

        self.assertEqual(updated.name, "Tomates Bio")
        self.assertEqual(updated.quantity_kg, 25)
        self.assertEqual(updated.min_stock, 8)
        self.assertEqual(updated.province, "Kayanza")

        self.main.delete_product(product.id, farmer_id=farmer.id, db=self.db)
        self.assertIsNone(self.db.query(self.models.Product).filter_by(id=product.id).first())

    def test_delete_product_route_rejects_when_order_history_exists(self):
        # Contrairement au test ci-dessus (main.delete_product, jamais monté
        # sur une route), celui-ci appelle products_router.delete_product —
        # la VRAIE fonction exécutée par DELETE /products/{id} en production.
        # Avant le correctif, tenter de supprimer un produit déjà commandé
        # levait une IntegrityError non gérée (500) au lieu d'un refus propre.
        farmer = self.create_user("+257790000041", "farmer", "Fermier Historique", province="Ngozi")
        buyer = self.create_user("+257790000042", "buyer", "Acheteur Historique", province="Bujumbura")
        product = self.create_product(farmer.id, "Avocats", "fruits", "Ngozi")

        self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=1),
            buyer_id=buyer.id,
            db=self.db,
        )

        request = self.authenticated_router_request(farmer)
        with self.assertRaises(HTTPException) as ctx:
            self.products_router.delete_product(product.id, request, db=self.db)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("déjà été commandé", ctx.exception.detail)
        self.assertIsNotNone(self.db.query(self.models.Product).filter_by(id=product.id).first())

    def test_stock_movements_are_recorded_for_create_update_and_order(self):
        farmer = self.create_user("+257790000035", "farmer", "Fermier Stock", province="Ngozi")
        buyer = self.create_user("+257790000036", "buyer", "Acheteur Stock", province="Bujumbura")
        product = self.create_product(farmer.id, "Tomates", "legumes", "Ngozi")

        initial_movements = self.main.read_stock_movements(farmer_id=farmer.id, db=self.db)
        self.assertEqual(len(initial_movements), 1)
        self.assertEqual(initial_movements[0].movement_type, "initial_stock")
        self.assertEqual(initial_movements[0].quantity_delta, 10)
        self.assertEqual(initial_movements[0].quantity_before, 0)
        self.assertEqual(initial_movements[0].quantity_after, 10)
        self.assertEqual(initial_movements[0].product_name_snapshot, "Tomates")

        self.main.update_product(
            product.id,
            self.schemas.ProductUpdate(quantity_kg=25),
            farmer_id=farmer.id,
            db=self.db,
        )

        order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=4),
            buyer_id=buyer.id,
            db=self.db,
        )

        movements = self.main.read_stock_movements(farmer_id=farmer.id, db=self.db)
        self.assertEqual(len(movements), 3)

        self.assertEqual(movements[0].movement_type, "order_out")
        self.assertEqual(movements[0].quantity_delta, -4)
        self.assertEqual(movements[0].quantity_before, 25)
        self.assertEqual(movements[0].quantity_after, 21)
        self.assertIn(str(order.id), movements[0].reason)

        self.assertEqual(movements[1].movement_type, "manual_adjustment")
        self.assertEqual(movements[1].quantity_delta, 15)
        self.assertEqual(movements[1].quantity_before, 10)
        self.assertEqual(movements[1].quantity_after, 25)

        product_movements = self.main.read_stock_movements(
            farmer_id=farmer.id,
            product_id=product.id,
            db=self.db,
        )
        self.assertEqual(len(product_movements), 3)

    def test_stock_adjustment_reason_codes_are_recorded_and_filtered(self):
        farmer = self.create_user("+257790000037", "farmer", "Fermier Raisons", province="Ngozi")
        product = self.create_product(farmer.id, "Pommes de terre", "tubercules", "Ngozi")
        self.create_product(farmer.id, "Haricots", "legumes", "Ngozi")

        self.main.update_product(
            product.id,
            self.schemas.ProductUpdate(
                quantity_kg=14,
                stock_reason_code="stock_return",
                stock_reason_note="Retour du marché",
            ),
            farmer_id=farmer.id,
            db=self.db,
        )
        self.main.update_product(
            product.id,
            self.schemas.ProductUpdate(quantity_kg=16, stock_reason_code="order_cancellation"),
            farmer_id=farmer.id,
            db=self.db,
        )
        self.main.update_product(
            product.id,
            self.schemas.ProductUpdate(
                quantity_kg=13,
                stock_reason_code="damage",
                stock_reason_note="Humidité",
            ),
            farmer_id=farmer.id,
            db=self.db,
        )

        product_movements = self.main.read_stock_movements(
            farmer_id=farmer.id,
            product_id=product.id,
            limit=10,
            db=self.db,
        )

        self.assertEqual(len(product_movements), 4)
        self.assertEqual(product_movements[0].movement_type, "damage")
        self.assertIn("Avarie de stock", product_movements[0].reason)
        self.assertIn("Humidité", product_movements[0].reason)
        self.assertEqual(product_movements[1].movement_type, "order_cancel_return")
        self.assertIn("Retour après annulation de commande", product_movements[1].reason)
        self.assertEqual(product_movements[2].movement_type, "stock_return")
        self.assertIn("Retour de stock", product_movements[2].reason)
        self.assertEqual(product_movements[3].movement_type, "initial_stock")

        all_movements = self.main.read_stock_movements(farmer_id=farmer.id, limit=10, db=self.db)
        self.assertEqual(len(all_movements), 5)

    def test_update_product_rejects_incompatible_stock_adjustment_reason(self):
        farmer = self.create_user("+257790000038", "farmer", "Fermier Validation", province="Ngozi")
        product = self.create_product(farmer.id, "Carottes", "legumes", "Ngozi")

        with self.assertRaises(HTTPException) as ctx:
            self.main.update_product(
                product.id,
                self.schemas.ProductUpdate(quantity_kg=8, stock_reason_code="stock_return"),
                farmer_id=farmer.id,
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        refreshed = self.db.query(self.models.Product).filter_by(id=product.id).first()
        self.assertEqual(refreshed.quantity_kg, 10)
        self.assertEqual(len(self.main.read_stock_movements(farmer_id=farmer.id, db=self.db)), 1)

    def test_update_and_delete_product_reject_non_owner(self):
        farmer = self.create_user("+257790000041", "farmer", "Fermier Owner", province="Ngozi")
        intruder = self.create_user("+257790000042", "farmer", "Fermier Intrus", province="Gitega")
        product = self.create_product(farmer.id, "Haricots", "legumes", "Ngozi")

        with self.assertRaises(HTTPException) as update_ctx:
            self.main.update_product(
                product.id,
                self.schemas.ProductUpdate(name="Haricots Rouges"),
                farmer_id=intruder.id,
                db=self.db,
            )
        self.assertEqual(update_ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as delete_ctx:
            self.main.delete_product(product.id, farmer_id=intruder.id, db=self.db)
        self.assertEqual(delete_ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()