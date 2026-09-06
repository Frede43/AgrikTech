import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class FileStorageServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.chdir(BACKEND_DIR)
        for name in list(sys.modules):
            if name == "backend" or name.startswith("backend."):
                sys.modules.pop(name, None)
        cls.config = importlib.import_module("backend.config")
        cls.file_storage_service = importlib.import_module("backend.services.file_storage_service")

    def setUp(self):
        # Isole chaque test des vraies variables d'environnement ImageKit
        # (si jamais définies sur la machine qui exécute les tests).
        self._original_keys = (
            self.config.IMAGEKIT_PUBLIC_KEY,
            self.config.IMAGEKIT_PRIVATE_KEY,
            self.config.IMAGEKIT_URL_ENDPOINT,
        )
        self.config.IMAGEKIT_PUBLIC_KEY = ""
        self.config.IMAGEKIT_PRIVATE_KEY = ""
        self.config.IMAGEKIT_URL_ENDPOINT = ""

    def tearDown(self):
        (
            self.config.IMAGEKIT_PUBLIC_KEY,
            self.config.IMAGEKIT_PRIVATE_KEY,
            self.config.IMAGEKIT_URL_ENDPOINT,
        ) = self._original_keys

    def test_is_imagekit_configured_requires_all_three_keys(self):
        self.assertFalse(self.file_storage_service.is_imagekit_configured())

        self.config.IMAGEKIT_PUBLIC_KEY = "pub"
        self.config.IMAGEKIT_PRIVATE_KEY = "priv"
        self.assertFalse(self.file_storage_service.is_imagekit_configured())

        self.config.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/demo"
        self.assertTrue(self.file_storage_service.is_imagekit_configured())

    def test_falls_back_to_local_disk_when_imagekit_not_configured(self):
        with tempfile.TemporaryDirectory() as tmp:
            url = self.file_storage_service.store_uploaded_file(
                b"fake-bytes",
                "photo.JPG",
                prefix="prod_1",
                folder="/products/",
                local_dir=tmp,
                local_url_prefix="/static/uploads",
            )

            self.assertTrue(url.startswith("/static/uploads/prod_1_"))
            self.assertTrue(url.endswith(".jpg"))
            saved_filename = url.rsplit("/", 1)[-1]
            saved_path = os.path.join(tmp, saved_filename)
            self.assertTrue(os.path.exists(saved_path))
            with open(saved_path, "rb") as f:
                self.assertEqual(f.read(), b"fake-bytes")

    def test_uploads_to_imagekit_when_configured(self):
        self.config.IMAGEKIT_PUBLIC_KEY = "public_test"
        self.config.IMAGEKIT_PRIVATE_KEY = "private_test"
        self.config.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/demo"

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {"url": "https://ik.imagekit.io/demo/products/prod_2_abcdef12.png"}

        with patch("backend.services.file_storage_service.requests.post", return_value=fake_response) as mock_post:
            url = self.file_storage_service.store_uploaded_file(
                b"fake-bytes",
                "photo.png",
                prefix="prod_2",
                folder="/products/",
                local_dir="/should/not/be/used",
                local_url_prefix="/static/uploads",
            )

        self.assertEqual(url, "https://ik.imagekit.io/demo/products/prod_2_abcdef12.png")
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["auth"], ("private_test", ""))
        self.assertEqual(kwargs["data"]["folder"], "/products/")
        self.assertIn("file", kwargs["files"])

    def test_raises_on_imagekit_error_response(self):
        self.config.IMAGEKIT_PUBLIC_KEY = "public_test"
        self.config.IMAGEKIT_PRIVATE_KEY = "private_test"
        self.config.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/demo"

        fake_response = MagicMock()
        fake_response.status_code = 401
        fake_response.text = "Invalid ImageKit credentials"

        with patch("backend.services.file_storage_service.requests.post", return_value=fake_response):
            with self.assertRaises(RuntimeError):
                self.file_storage_service.store_uploaded_file(
                    b"fake-bytes",
                    "photo.png",
                    prefix="prod_3",
                    folder="/products/",
                    local_dir="/should/not/be/used",
                    local_url_prefix="/static/uploads",
                )


if __name__ == "__main__":
    unittest.main()
