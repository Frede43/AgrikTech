import asyncio
import importlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, UploadFile

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class RequestStub:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class ResponseStub:
    def __init__(self):
        self.cookies_set = {}
        self.cookies_deleted = {}

    def set_cookie(self, key, value="", **kwargs):
        self.cookies_set[key] = {"value": value, **kwargs}

    def delete_cookie(self, key, **kwargs):
        self.cookies_deleted[key] = kwargs


class UploadRootAndOtpEdgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._upload_dir = Path(cls._tmpdir.name) / "uploads"
        cls._upload_dir.mkdir(exist_ok=True)
        os.environ["DATABASE_URL"] = f"sqlite:///{Path(cls._tmpdir.name) / 'test.db'}"
        os.chdir(BACKEND_DIR)
        for name in list(sys.modules):
            if name == "backend" or name.startswith("backend.") or name in ("main", "models", "schemas", "database", "utils", "config"):
                sys.modules.pop(name, None)
        cls.database = importlib.import_module("backend.database")
        cls.models = importlib.import_module("backend.models")
        cls.schemas = importlib.import_module("backend.schemas")
        cls.main = importlib.import_module("backend.main")
        cls.main.UPLOAD_DIR = str(cls._upload_dir)

    @classmethod
    def tearDownClass(cls):
        cls.database.engine.dispose()
        cls._tmpdir.cleanup()

    def setUp(self):
        self.models.Base.metadata.drop_all(bind=self.database.engine)
        self.models.Base.metadata.create_all(bind=self.database.engine)
        self.main.pending_otps.clear()
        self.main.auth_sessions.clear()
        self.db = self.database.SessionLocal()

    def tearDown(self):
        self.db.close()

    def create_user(self, phone: str, role: str, name: str, province: str = "Bujumbura"):
        return self.main.create_user(self.schemas.UserCreate(phone_number=phone, role=role, name=name, province=province), db=self.db)

    def create_product(self, farmer_id: int):
        return self.main.create_product(
            self.schemas.ProductCreate(name="Patates", category="tubercules", price_per_kg=1200, unit="kg", quantity_kg=12, province="Ngozi"),
            farmer_id=farmer_id,
            db=self.db,
        )

    def test_root_and_generic_upload_return_expected_payloads(self):
        root = self.main.read_root()
        upload = UploadFile(filename="preuve.png", file=io.BytesIO(b"file-bytes"))

        result = asyncio.run(self.main.upload_file(upload))
        stored_path = Path(self.main.UPLOAD_DIR) / Path(result["url"]).name

        self.assertIn("AgriConnect Burundi", root["message"])
        self.assertTrue(result["url"].startswith("/static/uploads/"))
        self.assertTrue(result["url"].endswith(".png"))
        self.assertTrue(stored_path.exists())

    def test_verify_otp_rejects_stale_and_reused_codes(self):
        user = self.create_user("+257700001111", "buyer", "Acheteur OTP Edge")
        first = self.main.request_otp(user.phone_number, db=self.db)
        second = self.main.request_otp(user.phone_number, db=self.db)

        with self.assertRaises(HTTPException) as stale_error:
            self.main.verify_otp(user.phone_number, first["mock_otp"], RequestStub(), ResponseStub(), db=self.db)
        self.assertEqual(stale_error.exception.status_code, 400)

        response = ResponseStub()
        verified = self.main.verify_otp(user.phone_number, second["mock_otp"], RequestStub(), response, db=self.db)
        self.assertTrue(verified["registered"])
        self.assertEqual(verified["user_id"], user.id)
        self.assertNotIn(user.phone_number, self.main.pending_otps)
        session_token = response.cookies_set[self.main.SESSION_COOKIE_NAME]["value"]
        session = self.main.auth_me(RequestStub({self.main.SESSION_COOKIE_NAME: session_token}), db=self.db)
        self.assertEqual(session.user_id, user.id)
        self.assertEqual(session.role, "acheteur")

        with self.assertRaises(HTTPException) as reused_error:
            self.main.verify_otp(user.phone_number, second["mock_otp"], RequestStub(), ResponseStub(), db=self.db)
        self.assertEqual(reused_error.exception.status_code, 400)

    def test_request_otp_rejects_suspended_user_with_clear_message(self):
        user = self.create_user("+257700009999", "buyer", "Acheteur Suspendu")
        user.is_active = False
        self.db.commit()
        self.db.refresh(user)

        with self.assertRaises(HTTPException) as suspended_error:
            self.main.request_otp(user.phone_number, db=self.db)

        self.assertEqual(suspended_error.exception.status_code, 403)
        self.assertEqual(suspended_error.exception.detail, "Ce numéro a été suspendu. Contactez l'administrateur.")
        self.assertNotIn(user.phone_number, self.main.pending_otps)

    def test_verify_otp_rejects_suspended_user_with_clear_message(self):
        user = self.create_user("+257700009999", "buyer", "Acheteur Suspendu")
        user.is_active = False
        self.db.commit()
        self.db.refresh(user)

        self.main.pending_otps[user.phone_number] = "1234"
        response = ResponseStub()

        with self.assertRaises(HTTPException) as suspended_error:
            self.main.verify_otp(user.phone_number, "1234", RequestStub(), response, db=self.db)

        self.assertEqual(suspended_error.exception.status_code, 403)
        self.assertEqual(suspended_error.exception.detail, "Ce numéro a été suspendu. Contactez l'administrateur.")
        self.assertNotIn(user.phone_number, self.main.pending_otps)
        self.assertNotIn(self.main.SESSION_COOKIE_NAME, response.cookies_set)

    def test_upload_product_image_rejects_missing_product_and_keeps_extension(self):
        farmer = self.create_user("+257700002222", "farmer", "Fermier Upload Edge")
        product = self.create_product(farmer.id)

        with self.assertRaises(HTTPException) as missing_error:
            asyncio.run(self.main.upload_product_image(999999, UploadFile(filename="ghost.jpg", file=io.BytesIO(b"x")), db=self.db))
        self.assertEqual(missing_error.exception.status_code, 404)

        result = asyncio.run(self.main.upload_product_image(product.id, UploadFile(filename="photo.webp", file=io.BytesIO(b"image")), db=self.db))
        stored_path = Path(self.main.UPLOAD_DIR) / Path(result["image_url"]).name

        self.assertTrue(result["image_url"].endswith(".webp"))
        self.assertTrue(stored_path.exists())


if __name__ == "__main__":
    unittest.main()