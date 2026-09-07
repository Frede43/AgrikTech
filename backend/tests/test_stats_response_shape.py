import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class RequestStub:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class StatsResponseShapeTests(unittest.TestCase):
    """
    Régression pour le bug "Revenus commission" / "Taux de conversion" /
    "Taux d'annulation" affichés à NaN ou vide sur /admin : le routeur réel
    (backend/routers/stats.py::get_admin_stats) calcule et renvoie ces
    champs dans son dict, mais schemas.AdminStats (le response_model FastAPI
    de la route GET /stats/admin) ne les déclarait pas — Pydantic les
    éliminait donc silencieusement de la réponse HTTP réelle, alors que les
    tests existants n'appellent que la façade non-décorée `main.get_admin_stats`
    (qui renvoie le dict brut, jamais passé par le filtrage response_model) et
    ne pouvaient donc pas détecter ce problème.

    Ce test simule ce que FastAPI fait réellement pour une requête HTTP :
    valider le dict renvoyé par le routeur à travers schemas.AdminStats.
    """

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
        cls.stats_router = importlib.import_module("backend.routers.stats")
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
        return self.main.create_user(
            self.schemas.UserCreate(phone_number=phone, role=role, name=name, province=province),
            db=self.db,
        )

    def create_product(self, farmer_id: int, name: str, quantity: float, price: float):
        return self.main.create_product(
            self.schemas.ProductCreate(
                name=name, category="legumes", price_per_kg=price, quantity_kg=quantity,
                unit="kg", province="Bujumbura",
            ),
            farmer_id=farmer_id,
            db=self.db,
        )

    def authenticated_router_request(self, user):
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

    def test_admin_stats_route_preserves_commission_and_rate_fields_through_response_model(self):
        admin = self.create_user("+257771000001", "admin", "Admin Stats Shape")
        farmer = self.create_user("+257771000002", "farmer", "Fermier Stats Shape")
        buyer = self.create_user("+257771000003", "buyer", "Acheteur Stats Shape")
        driver = self.create_user("+257771000004", "driver", "Livreur Stats Shape")
        product = self.create_product(farmer.id, name="Tomates", quantity=10, price=1000)

        order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=2), buyer_id=buyer.id, db=self.db,
        )
        self.main.pickup_order(order.id, order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(order.id, order.delivery_otp, db=self.db)

        admin_request = self.authenticated_router_request(admin)
        raw = self.stats_router.get_admin_stats(admin_request, db=self.db)

        # Ce que FastAPI applique réellement pour une requête HTTP réelle :
        # filtrage/validation à travers le response_model déclaré sur la route.
        validated = self.schemas.AdminStats(**raw).model_dump()

        self.assertGreater(raw["commission_current_period"], 0)
        self.assertGreater(raw["total_commission_estimated"], 0)

        self.assertEqual(validated["commission_current_period"], raw["commission_current_period"])
        self.assertEqual(validated["total_commission_estimated"], raw["total_commission_estimated"])
        self.assertEqual(validated["conversion_rate"], raw["conversion_rate"])
        self.assertEqual(validated["cancellation_rate"], raw["cancellation_rate"])
        self.assertEqual(validated["cancelled_orders_total"], raw["cancelled_orders_total"])
        self.assertEqual(validated["cancelled_orders_current_period"], raw["cancelled_orders_current_period"])


if __name__ == "__main__":
    unittest.main()
