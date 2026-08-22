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


class MessagesRouterTests(unittest.TestCase):
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
        cls.messages_router = importlib.import_module("backend.routers.messages")
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

    def authenticated_router_request(self, user):
        """Voir la même justification détaillée dans test_supporting_endpoints.py :
        session réelle persistée en base, lue par utils.get_authenticated_user —
        le mécanisme effectivement utilisé par les routeurs réels."""
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

    def test_inbox_includes_both_sent_and_received_messages(self):
        buyer = self.create_user("+257790500001", "buyer", "Acheteur Messages", province="Bujumbura")
        farmer = self.create_user("+257790500002", "farmer", "Fermier Messages", province="Ngozi")

        buyer_request = self.authenticated_router_request(buyer)
        self.messages_router.send_message(
            self.schemas.MessageCreate(receiver_id=farmer.id, content="Bonjour, produit dispo ?"),
            buyer_request,
            db=self.db,
        )

        # Avant toute réponse, l'acheteur doit déjà voir SON PROPRE message
        # dans sa boîte — sinon une conversation qu'il démarre n'apparaît
        # jamais dans sa propre liste tant que l'autre partie n'a pas répondu.
        buyer_inbox_before_reply = self.messages_router.get_inbox(buyer_request, db=self.db)
        self.assertEqual(len(buyer_inbox_before_reply), 1)
        self.assertEqual(buyer_inbox_before_reply[0].content, "Bonjour, produit dispo ?")

        farmer_request = self.authenticated_router_request(farmer)
        farmer_inbox = self.messages_router.get_inbox(farmer_request, db=self.db)
        self.assertEqual(len(farmer_inbox), 1)

        self.messages_router.send_message(
            self.schemas.MessageCreate(receiver_id=buyer.id, content="Oui, encore 20kg."),
            farmer_request,
            db=self.db,
        )

        # Après la réponse, chacun voit les DEUX messages du fil (envoyé + reçu).
        buyer_inbox_after_reply = self.messages_router.get_inbox(buyer_request, db=self.db)
        farmer_inbox_after_reply = self.messages_router.get_inbox(farmer_request, db=self.db)
        self.assertEqual(len(buyer_inbox_after_reply), 2)
        self.assertEqual(len(farmer_inbox_after_reply), 2)
        self.assertEqual(
            {m.content for m in buyer_inbox_after_reply},
            {"Bonjour, produit dispo ?", "Oui, encore 20kg."},
        )

    def test_send_message_rejects_unknown_receiver(self):
        buyer = self.create_user("+257790500003", "buyer", "Acheteur Inconnu", province="Bujumbura")
        buyer_request = self.authenticated_router_request(buyer)

        with self.assertRaises(HTTPException) as ctx:
            self.messages_router.send_message(
                self.schemas.MessageCreate(receiver_id=999999, content="Salut"),
                buyer_request,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    def test_unread_count_and_mark_as_read(self):
        buyer = self.create_user("+257790500004", "buyer", "Acheteur Lecture", province="Bujumbura")
        farmer = self.create_user("+257790500005", "farmer", "Fermier Lecture", province="Ngozi")
        buyer_request = self.authenticated_router_request(buyer)
        farmer_request = self.authenticated_router_request(farmer)

        sent = self.messages_router.send_message(
            self.schemas.MessageCreate(receiver_id=farmer.id, content="Toujours dispo ?"),
            buyer_request,
            db=self.db,
        )

        self.assertEqual(self.messages_router.unread_count(farmer_request, db=self.db), {"unread": 1})
        self.assertEqual(self.messages_router.unread_count(buyer_request, db=self.db), {"unread": 0})

        self.messages_router.mark_as_read(sent.id, farmer_request, db=self.db)
        self.assertEqual(self.messages_router.unread_count(farmer_request, db=self.db), {"unread": 0})

        refreshed = self.db.query(self.models.Message).filter_by(id=sent.id).one()
        self.assertIsNotNone(refreshed.read_at)


if __name__ == "__main__":
    unittest.main()
