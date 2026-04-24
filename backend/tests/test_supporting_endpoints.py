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
        self.status_code = None

    def set_cookie(self, key, value="", **kwargs):
        self.cookies_set[key] = {"value": value, **kwargs}

    def delete_cookie(self, key, **kwargs):
        self.cookies_deleted[key] = kwargs


class SupportingEndpointsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._db_path = Path(cls._tmpdir.name) / "test.db"
        cls._upload_dir = Path(cls._tmpdir.name) / "uploads"
        cls._upload_dir.mkdir(exist_ok=True)
        os.environ["DATABASE_URL"] = f"sqlite:///{cls._db_path}"
        os.chdir(BACKEND_DIR)
        for name in ("main", "models", "schemas", "database"):
            sys.modules.pop(name, None)
        cls.database = importlib.import_module("database")
        cls.models = importlib.import_module("models")
        cls.schemas = importlib.import_module("schemas")
        cls.main = importlib.import_module("main")
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
        self.main.mock_mobile_money_payouts.clear()
        self.db = self.database.SessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()
        self.database.engine.dispose()

    def create_user(self, phone_number: str, role: str, name: str, province: str = "Bujumbura"):
        return self.main.create_user(
            self.schemas.UserCreate(phone_number=phone_number, role=role, name=name, province=province),
            db=self.db,
        )

    def create_product(self, farmer_id: int, province: str = "Kayanza", price_per_kg: float = 2000.0):
        return self.main.create_product(
            self.schemas.ProductCreate(
                name="Haricots",
                category="legumes",
                price_per_kg=price_per_kg,
                unit="kg",
                quantity_kg=50,
                province=province,
            ),
            farmer_id=farmer_id,
            db=self.db,
        )

    def authenticated_request(self, user):
        response = ResponseStub()
        self.main.set_authenticated_session(response, user)
        session_token = response.cookies_set[self.main.SESSION_COOKIE_NAME]["value"]
        return RequestStub({self.main.SESSION_COOKIE_NAME: session_token})

    def test_otp_flow_handles_registered_and_new_numbers(self):
        existing = self.create_user("+257711111111", "buyer", "Acheteur OTP")

        otp_existing = self.main.request_otp(existing.phone_number, db=self.db)
        response_existing = ResponseStub()
        verified_existing = self.main.verify_otp(
            existing.phone_number,
            otp_existing["mock_otp"],
            RequestStub(),
            response_existing,
            db=self.db,
        )
        self.assertTrue(verified_existing["registered"])
        self.assertEqual(verified_existing["user_id"], existing.id)
        self.assertEqual(verified_existing["role"], "acheteur")
        self.assertNotIn(existing.phone_number, self.main.pending_otps)
        session_token = response_existing.cookies_set[self.main.SESSION_COOKIE_NAME]["value"]
        self.assertIn(session_token, self.main.auth_sessions)

        session_request = RequestStub({self.main.SESSION_COOKIE_NAME: session_token})
        current_session = self.main.auth_me(session_request, db=self.db)
        self.assertEqual(current_session.user_id, existing.id)
        self.assertEqual(current_session.role, "acheteur")

        logout_response = ResponseStub()
        self.main.logout(session_request, logout_response)
        self.assertEqual(logout_response.status_code, 204)
        self.assertNotIn(session_token, self.main.auth_sessions)
        self.assertIn(self.main.SESSION_COOKIE_NAME, logout_response.cookies_deleted)

        with self.assertRaises(HTTPException) as logged_out_error:
            self.main.auth_me(session_request, db=self.db)
        self.assertEqual(logged_out_error.exception.status_code, 401)

        otp_new = self.main.request_otp("+257722222222", db=self.db)
        response_new = ResponseStub()
        verified_new = self.main.verify_otp(
            "+257722222222",
            otp_new["mock_otp"],
            RequestStub(),
            response_new,
            db=self.db,
        )
        self.assertFalse(verified_new["registered"])
        self.assertIn("compléter votre profil", verified_new["message"])
        self.assertNotIn(self.main.SESSION_COOKIE_NAME, response_new.cookies_set)

        self.main.request_otp("+257733333333", db=self.db)
        with self.assertRaises(HTTPException):
            self.main.verify_otp("+257733333333", "0000", RequestStub(), ResponseStub(), db=self.db)

    def test_register_opens_session_for_new_user(self):
        response = ResponseStub()

        session = self.main.register_user(
            self.schemas.UserCreate(
                phone_number="+257766666666",
                role="farmer",
                name="Fermier Register",
                province="Ngozi",
            ),
            response=response,
            db=self.db,
        )

        self.assertEqual(session.role, "fermier")
        session_token = response.cookies_set[self.main.SESSION_COOKIE_NAME]["value"]
        session_request = RequestStub({self.main.SESSION_COOKIE_NAME: session_token})
        current_session = self.main.auth_me(session_request, db=self.db)

        self.assertEqual(current_session.user_id, session.user_id)
        self.assertEqual(current_session.role, "fermier")
        self.assertIn(session_token, self.main.auth_sessions)

    def test_upload_product_image_persists_file_and_image_url(self):
        farmer = self.create_user("+257744444444", "farmer", "Fermier Upload")
        product = self.create_product(farmer.id)
        upload = UploadFile(filename="photo.jpg", file=io.BytesIO(b"fake-image-bytes"))

        result = asyncio.run(self.main.upload_product_image(product.id, upload, db=self.db))
        refreshed = self.db.query(self.models.Product).filter_by(id=product.id).first()
        stored_path = Path(self.main.UPLOAD_DIR) / Path(result["image_url"]).name

        self.assertEqual(result["status"], "Image téléchargée avec succès")
        self.assertTrue(result["image_url"].startswith("/static/uploads/prod_"))
        self.assertEqual(refreshed.image_url, result["image_url"])
        self.assertTrue(stored_path.exists())

    def test_admin_stats_aggregate_legacy_and_canonical_farmer_roles(self):
        farmer_one = self.create_user("+257755555551", "farmer", "Fermier One", province="Ngozi")
        buyer = self.create_user("+257755555552", "buyer", "Acheteur Admin", province="Bujumbura")
        driver = self.create_user("+257755555553", "driver", "Livreur Admin", province="Gitega")

        farmer_two = self.models.User(
            phone_number="+257755555554",
            role="farmer",
            name="Legacy Farmer",
            province="Kirundo",
            balance=0,
            is_active=True,
        )
        self.db.add(farmer_two)
        self.db.commit()
        self.db.refresh(farmer_two)

        product_one = self.create_product(farmer_one.id, province="Ngozi", price_per_kg=2000)
        product_two = self.create_product(farmer_two.id, province="Kirundo", price_per_kg=3000)
        order_one = self.main.create_order(self.schemas.OrderCreate(product_id=product_one.id, quantity=2), buyer_id=buyer.id, db=self.db)
        order_two = self.main.create_order(self.schemas.OrderCreate(product_id=product_two.id, quantity=1), buyer_id=buyer.id, db=self.db)
        self.main.pickup_order(order_one.id, order_one.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(order_one.id, order_one.delivery_otp, db=self.db)
        farmer_one.balance = 15000
        self.db.commit()
        self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer_one.id,
                amount=12000,
                channel="Lumicash",
                phone_number="+257755555559",
            ),
            db=self.db,
        )

        stats = self.main.get_admin_stats(db=self.db)

        self.assertAlmostEqual(stats["gmv"], 7000.0)
        self.assertEqual(stats["active_farmers"], 2)
        self.assertEqual(stats["active_orders"], 1)
        self.assertAlmostEqual(stats["total_payouts"], 3800.0)
        self.assertAlmostEqual(stats["commission_rate"], self.main.DEFAULT_COMMISSION_RATE)
        self.assertEqual(stats["payout_beneficiaries"], 1)
        self.assertEqual(stats["payout_releases"], 1)
        self.assertEqual(stats["kpi_growth"], {
            "gmv": 100.0,
            "active_farmers": 100.0,
            "active_orders": 100.0,
            "total_payouts": 100.0,
        })
        self.assertEqual(stats["pending_withdrawals"], 1)
        self.assertAlmostEqual(stats["pending_withdrawal_amount"], 12000.0)
        self.assertEqual(stats["completed_withdrawals"], 0)
        self.assertAlmostEqual(stats["completed_withdrawal_amount"], 0.0)
        self.assertEqual(stats["rejected_withdrawals"], 0)
        self.assertAlmostEqual(stats["rejected_withdrawal_amount"], 0.0)
        self.assertEqual(stats["total_withdrawal_requests"], 1)
        self.assertAlmostEqual(stats["average_withdrawal_amount"], 12000.0)
        self.assertEqual(stats["in_review_disputes"], 0)
        self.assertEqual(stats["resolved_disputes"], 0)
        self.assertEqual(stats["high_priority_disputes"], 0)
        self.assertEqual({item["province"] for item in stats["province_data"]}, {"Ngozi", "Kirundo"})
        self.assertTrue(all(item.get("id") for item in stats["top_farmers"]))
        self.assertEqual(stats["top_farmers"][0]["id"], farmer_one.id)
        self.assertTrue(
            any(
                item["type"] == "payout"
                and item["reference"] == "WDR-1"
                and item["priority"] in {"low", "medium", "high"}
                and "+257755555559" in item["body"]
                for item in stats["recent_notifications"]
            )
        )

    def test_notification_dismiss_endpoint_requires_authentication(self):
        with self.assertRaises(HTTPException) as context:
            self.main.dismiss_notification(
                self.schemas.NotificationDismissRequest(notification_id="buyer-order-1"),
                RequestStub(),
                db=self.db,
            )

        self.assertEqual(context.exception.status_code, 401)

    def test_notification_dismiss_endpoint_is_idempotent_and_filters_admin_stats(self):
        admin = self.create_user("+257755555561", "admin", "Admin Notifications", province="Bujumbura")
        farmer = self.create_user("+257755555562", "farmer", "Fermier Notifications", province="Ngozi")
        buyer = self.create_user("+257755555563", "buyer", "Acheteur Notifications", province="Bujumbura")
        product = self.create_product(farmer.id, province="Ngozi", price_per_kg=2200)
        self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=2),
            buyer_id=buyer.id,
            db=self.db,
        )

        request = self.authenticated_request(admin)

        initial_stats = self.main.get_admin_stats(request=request, db=self.db)
        self.assertTrue(initial_stats["recent_notifications"])
        dismissed_notification_id = initial_stats["recent_notifications"][0]["id"]

        first_response = self.main.dismiss_notification(
            self.schemas.NotificationDismissRequest(notification_id=dismissed_notification_id),
            request,
            db=self.db,
        )
        second_response = self.main.dismiss_notification(
            self.schemas.NotificationDismissRequest(notification_id=dismissed_notification_id),
            request,
            db=self.db,
        )

        self.assertEqual(first_response.status_code, 204)
        self.assertEqual(second_response.status_code, 204)
        self.assertEqual(
            self.db.query(self.models.NotificationDismissal)
            .filter_by(user_id=admin.id, notification_id=dismissed_notification_id)
            .count(),
            1,
        )

        filtered_stats = self.main.get_admin_stats(request=request, db=self.db)
        filtered_notifications = self.main.get_notifications(admin.id, request=request, db=self.db)

        self.assertNotIn(
            dismissed_notification_id,
            {item["id"] for item in filtered_stats["recent_notifications"]},
        )
        self.assertNotIn(
            dismissed_notification_id,
            {item["id"] for item in filtered_notifications},
        )
        self.assertLessEqual(
            filtered_stats["unread_notifications"],
            initial_stats["unread_notifications"],
        )

    def test_notifications_endpoint_requires_authentication(self):
        buyer = self.create_user("+257755555564", "buyer", "Acheteur Secure", province="Bujumbura")

        with self.assertRaises(HTTPException) as context:
            self.main.get_notifications(buyer.id, request=RequestStub(), db=self.db)

        self.assertEqual(context.exception.status_code, 401)

    def test_notifications_endpoint_forbids_access_to_another_user(self):
        buyer = self.create_user("+257755555565", "buyer", "Acheteur A", province="Bujumbura")
        other_buyer = self.create_user("+257755555566", "buyer", "Acheteur B", province="Ngozi")

        with self.assertRaises(HTTPException) as context:
            self.main.get_notifications(other_buyer.id, request=self.authenticated_request(buyer), db=self.db)

        self.assertEqual(context.exception.status_code, 403)

    def test_notifications_endpoint_allows_authenticated_user_to_read_own_notifications(self):
        farmer = self.create_user("+257755555567", "farmer", "Fermier Secure", province="Ngozi")
        buyer = self.create_user("+257755555568", "buyer", "Acheteur Secure OK", province="Bujumbura")
        product = self.create_product(farmer.id, province="Ngozi", price_per_kg=2300)
        self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=1),
            buyer_id=buyer.id,
            db=self.db,
        )

        notifications = self.main.get_notifications(buyer.id, request=self.authenticated_request(buyer), db=self.db)

        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["type"], "order")

    def test_admin_settings_can_be_read_updated_and_extended_with_admin_agents(self):
        defaults = self.main.get_admin_settings(db=self.db)

        self.assertAlmostEqual(defaults["commission_rate"], self.main.DEFAULT_COMMISSION_RATE)
        self.assertFalse(defaults["maintenance_mode"])
        self.assertEqual(defaults["support_phone"], self.main.DEFAULT_SUPPORT_PHONE)
        self.assertEqual(defaults["support_whatsapp"], self.main.DEFAULT_SUPPORT_WHATSAPP)
        self.assertEqual(defaults["admins"], [])

        created_admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799111111",
                name="Admin Paramètres",
                province="Ngozi",
            ),
            db=self.db,
        )
        updated = self.main.update_admin_settings(
            self.schemas.PlatformSettingsUpdate(
                commission_rate=0.12,
                maintenance_mode=True,
                support_phone="+257700000001",
                support_whatsapp="+257700000002",
            ),
            db=self.db,
        )

        self.assertEqual(created_admin.role, "admin")
        self.assertAlmostEqual(updated["commission_rate"], 0.12)
        self.assertTrue(updated["maintenance_mode"])
        self.assertEqual(updated["support_phone"], "+257700000001")
        self.assertEqual(updated["support_whatsapp"], "+257700000002")
        self.assertIsNotNone(updated["updated_at"])
        self.assertEqual(len(updated["admins"]), 1)
        self.assertEqual(updated["admins"][0]["phone_number"], created_admin.phone_number)
        self.assertEqual(updated["admins"][0]["province"], "Ngozi")

        with self.assertRaises(HTTPException) as invalid_commission:
            self.main.update_admin_settings(
                self.schemas.PlatformSettingsUpdate(commission_rate=0.75),
                db=self.db,
            )
        self.assertEqual(invalid_commission.exception.status_code, 400)

        with self.assertRaises(HTTPException) as blank_support:
            self.main.update_admin_settings(
                self.schemas.PlatformSettingsUpdate(support_phone="   "),
                db=self.db,
            )
        self.assertEqual(blank_support.exception.status_code, 400)

    def test_support_tickets_can_be_created_trimmed_and_listed_latest_first(self):
        buyer = self.create_user("+257799222221", "buyer", "Acheteur Support", province="Bujumbura")

        first_ticket = self.main.create_support_ticket(
            self.schemas.SupportTicketCreate(
                user_id=buyer.id,
                channel=" WhatsApp ",
                subject="  Retard de livraison  ",
                message="  Où se trouve mon colis ?  ",
            ),
            db=self.db,
        )
        second_ticket = self.main.create_support_ticket(
            self.schemas.SupportTicketCreate(
                user_id=buyer.id,
                subject="Paiement",
                message="Je souhaite vérifier mon remboursement.",
            ),
            db=self.db,
        )
        tickets = self.main.list_support_tickets(buyer.id, db=self.db)

        self.assertEqual(first_ticket.role, "acheteur")
        self.assertEqual(first_ticket.channel, "whatsapp")
        self.assertEqual(first_ticket.subject, "Retard de livraison")
        self.assertEqual(first_ticket.message, "Où se trouve mon colis ?")
        self.assertEqual(first_ticket.status, "open")
        self.assertEqual([ticket.id for ticket in tickets], [second_ticket.id, first_ticket.id])

        with self.assertRaises(HTTPException) as blank_subject:
            self.main.create_support_ticket(
                self.schemas.SupportTicketCreate(
                    user_id=buyer.id,
                    subject="   ",
                    message="Message valide",
                ),
                db=self.db,
            )
        self.assertEqual(blank_subject.exception.status_code, 400)

        with self.assertRaises(HTTPException) as missing_user:
            self.main.list_support_tickets(999999, db=self.db)
        self.assertEqual(missing_user.exception.status_code, 404)

    def test_public_testimonials_seed_automatically_and_hide_inactive_entries(self):
        testimonials = self.main.get_public_testimonials(db=self.db)

        self.assertEqual([item["author_name"] for item in testimonials], ["Pascal N.", "Sarah M."])
        self.assertEqual(testimonials[0]["author_role_fr"], "Fermier")
        self.assertEqual(testimonials[1]["quote_ki"], "Mbona imboga nshasha mu gitondo, zivuye vy'ukuri mu murima.")

        seeded_rows = (
            self.db.query(self.models.Testimonial)
            .order_by(self.models.Testimonial.sort_order.asc(), self.models.Testimonial.id.asc())
            .all()
        )
        self.assertEqual(len(seeded_rows), 2)

        seeded_rows[0].is_active = False
        self.db.add(
            self.models.Testimonial(
                quote_fr="AgriConnect m'aide à mieux planifier mes achats hebdomadaires.",
                quote_ki="AgriConnect imfasha gutunganya neza ivyo ngura buri ndwi.",
                author_name="Claire B.",
                author_role_fr="Acheteuse",
                author_role_ki="Umuguzi",
                location="Bujumbura",
                rating=4.0,
                sort_order=0,
                is_active=True,
            )
        )
        self.db.commit()

        refreshed = self.main.get_public_testimonials(db=self.db)
        self.assertEqual([item["author_name"] for item in refreshed], ["Claire B.", "Sarah M."])

    def test_testimonial_submission_is_pending_until_admin_approval_then_published(self):
        buyer = self.create_user("+257799455551", "buyer", "Alice Buyer", province="Ngozi")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799455552",
                name="Admin Témoignages",
                province="Gitega",
            ),
            db=self.db,
        )
        request = self.authenticated_request(buyer)

        created = self.main.create_testimonial_submission(
            self.schemas.TestimonialSubmissionCreate(
                message="Plateforme fiable et légumes bien frais.",
                rating=5,
            ),
            request=request,
            db=self.db,
        )

        self.assertEqual(created["status"], "pending")
        self.assertEqual(created["author_name"], "Alice Buyer")

        mine = self.main.get_my_testimonials(request, db=self.db)
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["status"], "pending")

        public_before = self.main.get_public_testimonials(db=self.db)
        self.assertFalse(any(item["author_name"] == "Alice Buyer" for item in public_before))

        admin_records_before = self.main.list_admin_testimonials(db=self.db)
        created_record = next(item for item in admin_records_before if item["authorName"] == "Alice Buyer")
        self.assertEqual(created_record["status"], "pending")

        self.main.approve_testimonial_submission(
            created["id"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Validation éditoriale OK."),
            db=self.db,
        )

        public_after = self.main.get_public_testimonials(db=self.db)
        self.assertTrue(any(item["author_name"] == "Alice Buyer" for item in public_after))

        mine_after = self.main.get_my_testimonials(request, db=self.db)
        self.assertEqual(mine_after[0]["status"], "approved")
        self.assertEqual(mine_after[0]["admin_note"], "Validation éditoriale OK.")

    def test_testimonial_submission_creates_admin_notification(self):
        buyer = self.create_user("+257799455571", "buyer", "Brigitte Buyer", province="Ngozi")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799455572",
                name="Admin Notifications Témoignages",
                province="Gitega",
            ),
            db=self.db,
        )

        created = self.main.create_testimonial_submission(
            self.schemas.TestimonialSubmissionCreate(
                message="Je reçois mes produits à temps et en bon état.",
                rating=5,
            ),
            request=self.authenticated_request(buyer),
            db=self.db,
        )

        testimonial_reference = self.main.format_testimonial_reference(created["id"])
        notifications = self.main.get_notifications(admin.id, request=self.authenticated_request(admin), db=self.db)
        stats = self.main.get_admin_stats(request=self.authenticated_request(admin), db=self.db)

        testimonial_notification = next(
            (item for item in notifications if item.get("reference") == testimonial_reference),
            None,
        )
        self.assertIsNotNone(testimonial_notification)
        self.assertEqual(testimonial_notification["type"], "testimonial")
        self.assertEqual(testimonial_notification["title"], "Nouveau témoignage soumis")
        self.assertFalse(testimonial_notification["read"])

        self.assertTrue(
            any(item.get("reference") == testimonial_reference for item in stats["recent_notifications"])
        )
        self.assertGreaterEqual(stats["unread_notifications"], 1)

    def test_buyer_notifications_include_testimonial_submission_and_approval(self):
        buyer = self.create_user("+257799455573", "buyer", "Buyer Feedback", province="Ngozi")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799455574",
                name="Admin Buyer Feedback",
                province="Bujumbura",
            ),
            db=self.db,
        )

        created = self.main.create_testimonial_submission(
            self.schemas.TestimonialSubmissionCreate(
                message="Le suivi de commande est clair et rassurant.",
                rating=5,
            ),
            request=self.authenticated_request(buyer),
            db=self.db,
        )

        testimonial_reference = self.main.format_testimonial_reference(created["id"])
        pending_notifications = self.main.get_notifications(
            buyer.id,
            request=self.authenticated_request(buyer),
            db=self.db,
        )
        pending_notification = next(
            (item for item in pending_notifications if item.get("reference") == testimonial_reference),
            None,
        )

        self.assertIsNotNone(pending_notification)
        self.assertEqual(pending_notification["type"], "testimonial")
        self.assertEqual(pending_notification["title"], "Témoignage reçu")
        self.assertIn("sera relu", pending_notification["body"])

        self.main.approve_testimonial_submission(
            created["id"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Publication validée."),
            db=self.db,
        )

        approved_notifications = self.main.get_notifications(
            buyer.id,
            request=self.authenticated_request(buyer),
            db=self.db,
        )
        approved_notification = next(
            (item for item in approved_notifications if item.get("reference") == testimonial_reference),
            None,
        )

        self.assertIsNotNone(approved_notification)
        self.assertEqual(approved_notification["type"], "testimonial")
        self.assertEqual(approved_notification["title"], "Témoignage approuvé")
        self.assertIn("Publication validée.", approved_notification["body"])

    def test_buyer_notifications_include_soko_live_market_alerts(self):
        buyer = self.create_user("+257799455577", "buyer", "Buyer Market", province="Kayanza")
        order_buyer = self.create_user("+257799455578", "buyer", "Buyer History", province="Bujumbura")
        farmer = self.create_user("+257799455579", "farmer", "Farmer Market", province="Kayanza")
        driver = self.create_user("+257799455580", "driver", "Driver Market", province="Ngozi")

        old_product = self.create_product(farmer.id, province="Kayanza", price_per_kg=2000)
        old_order = self.main.create_order(
            self.schemas.OrderCreate(product_id=old_product.id, quantity=2),
            buyer_id=order_buyer.id,
            db=self.db,
        )
        self.main.pickup_order(old_order.id, old_order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(old_order.id, old_order.delivery_otp, db=self.db)
        old_order.created_at = self.main.utcnow_naive() - self.main.timedelta(days=14)

        current_product = self.create_product(farmer.id, province="Kayanza", price_per_kg=2600)
        current_product.harvested_at = self.main.utcnow_naive()
        self.db.commit()

        notifications = self.main.get_notifications(
            buyer.id,
            request=self.authenticated_request(buyer),
            db=self.db,
        )
        market_notification = next((item for item in notifications if item.get("type") == "market"), None)

        self.assertIsNotNone(market_notification)
        self.assertEqual(market_notification["title"], "Prix en hausse — Haricots")
        self.assertIn("Kayanza", market_notification["body"])
        self.assertIn("Anticipez vos volumes", market_notification["body"])
        self.assertEqual(market_notification["market_scope"], "province")
        self.assertEqual(market_notification["market_scope_label"], "Kayanza")

    def test_farmer_notifications_include_testimonial_and_withdrawal_updates(self):
        farmer = self.create_user("+257799455575", "farmer", "Farmer Feedback", province="Muramvya")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799455576",
                name="Admin Farmer Feedback",
                province="Gitega",
            ),
            db=self.db,
        )

        farmer.balance = 100000
        self.db.add(
            self.models.WithdrawalRequest(
                user_id=farmer.id,
                amount=5000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
                status="completed",
                note="Historique confirmé.",
                processed_at=self.main.utcnow_naive(),
            )
        )
        self.db.commit()
        self.db.refresh(farmer)

        created = self.main.create_testimonial_submission(
            self.schemas.TestimonialSubmissionCreate(
                message="Le portefeuille fermier est pratique, mais je souhaite un retour officiel.",
                rating=4,
            ),
            request=self.authenticated_request(farmer),
            db=self.db,
        )
        self.main.reject_testimonial_submission(
            created["id"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Merci, mais message non retenu pour la home."),
            db=self.db,
        )

        auto_completed = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=10000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )
        pending = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=30000,
                channel="Ecocash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )

        pending_notifications = self.main.get_notifications(
            farmer.id,
            request=self.authenticated_request(farmer),
            db=self.db,
        )
        pending_notification = next(
            (item for item in pending_notifications if item.get("reference") == pending["id"]),
            None,
        )
        self.assertIsNotNone(pending_notification)
        self.assertEqual(pending_notification["type"], "payout")
        self.assertEqual(pending_notification["title"], "Retrait en attente")

        pending_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(pending["id"].split("-")[1])).one()
        self.main.approve_wallet_withdrawal(
            pending_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Validé manuellement."),
            db=self.db,
        )

        rejected = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=26000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )
        rejected_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(rejected["id"].split("-")[1])).one()
        self.main.reject_wallet_withdrawal(
            rejected_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Coordonnées incomplètes."),
            db=self.db,
        )

        notifications = self.main.get_notifications(
            farmer.id,
            request=self.authenticated_request(farmer),
            db=self.db,
        )
        testimonial_reference = self.main.format_testimonial_reference(created["id"])
        testimonial_notification = next(
            (item for item in notifications if item.get("reference") == testimonial_reference),
            None,
        )
        auto_completed_notification = next(
            (item for item in notifications if item.get("reference") == auto_completed["id"]),
            None,
        )
        approved_notification = next(
            (item for item in notifications if item.get("reference") == pending["id"]),
            None,
        )
        rejected_notification = next(
            (item for item in notifications if item.get("reference") == rejected["id"]),
            None,
        )

        self.assertIsNotNone(testimonial_notification)
        self.assertEqual(testimonial_notification["title"], "Témoignage refusé")
        self.assertIn("non retenu", testimonial_notification["body"])
        self.assertIn("message non retenu", testimonial_notification["body"])

        self.assertIsNotNone(auto_completed_notification)
        self.assertEqual(auto_completed_notification["title"], "Retrait traité")
        self.assertEqual(auto_completed_notification["type"], "payout")

        self.assertIsNotNone(approved_notification)
        self.assertEqual(approved_notification["title"], "Retrait traité")
        self.assertIn("Validé manuellement.", approved_notification["body"])

        self.assertIsNotNone(rejected_notification)
        self.assertEqual(rejected_notification["title"], "Retrait rejeté")
        self.assertIn("Coordonnées incomplètes.", rejected_notification["body"])

    def test_farmer_notifications_include_soko_live_market_alerts(self):
        farmer = self.create_user("+257799455581", "farmer", "Farmer Market Alert", province="Kayanza")
        buyer = self.create_user("+257799455582", "buyer", "Buyer Market Alert", province="Bujumbura")
        driver = self.create_user("+257799455583", "driver", "Driver Market Alert", province="Ngozi")

        old_product = self.create_product(farmer.id, province="Kayanza", price_per_kg=2000)
        old_order = self.main.create_order(
            self.schemas.OrderCreate(product_id=old_product.id, quantity=2),
            buyer_id=buyer.id,
            db=self.db,
        )
        self.main.pickup_order(old_order.id, old_order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(old_order.id, old_order.delivery_otp, db=self.db)
        old_order.created_at = self.main.utcnow_naive() - self.main.timedelta(days=14)

        current_product = self.create_product(farmer.id, province="Kayanza", price_per_kg=2600)
        current_product.harvested_at = self.main.utcnow_naive()
        self.db.commit()

        notifications = self.main.get_notifications(
            farmer.id,
            request=self.authenticated_request(farmer),
            db=self.db,
        )
        market_notification = next((item for item in notifications if item.get("type") == "market"), None)

        self.assertIsNotNone(market_notification)
        self.assertEqual(market_notification["title"], "Marché porteur — Haricots")
        self.assertIn("Kayanza", market_notification["body"])
        self.assertIn("vendre", market_notification["body"])

    def test_rejected_testimonial_stays_hidden_from_public_feed(self):
        farmer = self.create_user("+257799455561", "farmer", "Jean Fermier", province="Muramvya")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799455562",
                name="Admin Modération",
                province="Bujumbura",
            ),
            db=self.db,
        )
        request = self.authenticated_request(farmer)

        created = self.main.create_testimonial_submission(
            self.schemas.TestimonialSubmissionCreate(
                message="Bon service, mais je laisse l'admin décider de la publication.",
                rating=4,
            ),
            request=request,
            db=self.db,
        )

        self.main.reject_testimonial_submission(
            created["id"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Message refusé pour publication."),
            db=self.db,
        )

        public_testimonials = self.main.get_public_testimonials(db=self.db)
        self.assertFalse(any(item["author_name"] == "Jean Fermier" for item in public_testimonials))

        mine = self.main.get_my_testimonials(request, db=self.db)
        self.assertEqual(mine[0]["status"], "rejected")
        self.assertEqual(mine[0]["admin_note"], "Message refusé pour publication.")

        admin_records = self.main.list_admin_testimonials(status="rejected", db=self.db)
        self.assertTrue(any(item["authorName"] == "Jean Fermier" for item in admin_records))

    def test_admin_withdrawals_list_exposes_farmer_and_processing_metadata(self):
        farmer = self.create_user("+257799444441", "farmer", "Fermier Liste", province="Muyinga")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799444442",
                name="Admin Validation",
                province="Gitega",
            ),
            db=self.db,
        )

        farmer.balance = 50000
        self.db.commit()
        self.db.refresh(farmer)

        pending = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number="+257799444449",
            ),
            db=self.db,
        )
        approved = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=10000,
                channel="Ecocash",
                phone_number="+257799444448",
            ),
            db=self.db,
        )
        rejected = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=11000,
                channel="Lumicash",
                phone_number="+257799444447",
            ),
            db=self.db,
        )

        pending_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(pending["id"].split("-")[1])).one()
        approved_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(approved["id"].split("-")[1])).one()
        rejected_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(rejected["id"].split("-")[1])).one()

        self.main.approve_wallet_withdrawal(
            approved_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Validé en agence."),
            db=self.db,
        )
        self.main.reject_wallet_withdrawal(
            rejected_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Coordonnées incomplètes."),
            db=self.db,
        )

        withdrawals = self.main.list_admin_withdrawals(db=self.db)
        pending_only = self.main.list_admin_withdrawals(status="pending", db=self.db)
        completed_only = self.main.list_admin_withdrawals(status="completed", db=self.db)

        self.assertEqual([item["dbId"] for item in withdrawals], [rejected_request.id, approved_request.id, pending_request.id])
        self.assertEqual(withdrawals[0]["status"], "rejected")
        self.assertEqual(withdrawals[0]["processedByUserId"], admin.id)
        self.assertEqual(withdrawals[0]["processedByName"], "Admin Validation")
        self.assertEqual(withdrawals[0]["note"], "Coordonnées incomplètes.")
        self.assertEqual(withdrawals[1]["status"], "completed")
        self.assertEqual(withdrawals[1]["channel"], "Ecocash")
        self.assertEqual(withdrawals[1]["processedByName"], "Admin Validation")
        self.assertEqual([event["action"] for event in withdrawals[1]["auditTrail"]], ["WITHDRAWAL_REQUESTED", "WITHDRAWAL_APPROVED"])
        self.assertEqual(withdrawals[1]["auditTrail"][1]["actorName"], "Admin Validation")
        self.assertEqual(withdrawals[2]["status"], "pending")
        self.assertEqual(withdrawals[2]["phoneNumber"], "+257799444449")
        self.assertEqual(withdrawals[2]["processedByUserId"], None)
        self.assertEqual(withdrawals[2]["farmerId"], farmer.id)
        self.assertEqual(withdrawals[2]["farmerName"], "Fermier Liste")
        self.assertEqual(withdrawals[2]["farmerPhoneNumber"], farmer.phone_number)
        self.assertEqual(withdrawals[2]["province"], "Muyinga")
        self.assertTrue(withdrawals[2]["createdAt"])
        self.assertIsNone(withdrawals[2]["processedAt"])
        self.assertEqual([event["action"] for event in withdrawals[0]["auditTrail"]], ["WITHDRAWAL_REQUESTED", "WITHDRAWAL_REJECTED"])
        self.assertEqual(withdrawals[2]["auditTrail"][0]["action"], "WITHDRAWAL_REQUESTED")
        self.assertEqual(withdrawals[2]["auditTrail"][0]["actorName"], "Fermier Liste")
        self.assertEqual([item["status"] for item in pending_only], ["pending"])
        self.assertEqual([item["status"] for item in completed_only], ["completed"])

    def test_admin_notifications_and_stats_include_finance_breakdown(self):
        farmer = self.create_user("+257799555551", "farmer", "Fermier Finance", province="Ngozi")
        buyer = self.create_user("+257799555552", "buyer", "Acheteur Finance", province="Bujumbura")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799555553",
                name="Admin Finance",
                province="Gitega",
            ),
            db=self.db,
        )
        product = self.create_product(farmer.id, province="Ngozi", price_per_kg=3500)

        farmer.balance = 70000
        self.db.commit()
        self.db.refresh(farmer)

        pending = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number="+257799555559",
            ),
            db=self.db,
        )
        approved = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=10000,
                channel="Ecocash",
                phone_number="+257799555558",
            ),
            db=self.db,
        )
        rejected = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=11000,
                channel="Lumicash",
                phone_number="+257799555557",
            ),
            db=self.db,
        )

        approved_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(approved["id"].split("-")[1])).one()
        rejected_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(rejected["id"].split("-")[1])).one()

        self.main.approve_wallet_withdrawal(
            approved_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Paiement confirmé."),
            db=self.db,
        )
        self.main.reject_wallet_withdrawal(
            rejected_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Compte destinataire incohérent."),
            db=self.db,
        )

        open_order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=1),
            buyer_id=buyer.id,
            db=self.db,
        )
        resolved_order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=2),
            buyer_id=buyer.id,
            db=self.db,
        )

        open_dispute = self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=open_order.id,
                reason="Paiement en attente",
                detail="Le fermier signale un blocage sur le décaissement.",
                refund_requested=1500,
                priority="high",
            ),
            db=self.db,
        )
        resolved_dispute = self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=resolved_order.id,
                reason="Montant à rembourser",
                detail="Vérification manuelle requise.",
                refund_requested=2000,
                priority="medium",
            ),
            db=self.db,
        )
        self.main.review_dispute(
            resolved_dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )
        self.main.refund_dispute(
            resolved_dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )

        stats = self.main.get_admin_stats(db=self.db)
        notifications = self.main.get_notifications(admin.id, request=self.authenticated_request(admin), db=self.db)

        self.assertEqual(stats["total_withdrawal_requests"], 3)
        self.assertEqual(stats["pending_withdrawals"], 1)
        self.assertAlmostEqual(stats["pending_withdrawal_amount"], 12000.0)
        self.assertEqual(stats["completed_withdrawals"], 1)
        self.assertAlmostEqual(stats["completed_withdrawal_amount"], 10000.0)
        self.assertEqual(stats["rejected_withdrawals"], 1)
        self.assertAlmostEqual(stats["rejected_withdrawal_amount"], 11000.0)
        self.assertAlmostEqual(stats["average_withdrawal_amount"], 11000.0)
        self.assertEqual(stats["open_disputes"], 1)
        self.assertEqual(stats["in_review_disputes"], 0)
        self.assertEqual(stats["resolved_disputes"], 1)
        self.assertEqual(stats["high_priority_disputes"], 1)
        self.assertTrue(any(item.get("reference") == open_dispute["id"] and item.get("priority") == "high" for item in notifications))
        self.assertTrue(any(item.get("reference") == f"WDR-{approved_request.id}" and item.get("title") == "Retrait approuvé" for item in notifications))
        self.assertTrue(any(item.get("reference") == pending["id"] and item.get("type") == "payout" and not item.get("read") for item in notifications))
        self.assertTrue(any(item.get("reference") == resolved_dispute["id"] and item.get("title") == "Remboursement manuel lancé" for item in notifications))

    def test_admin_finance_audits_expose_filters_and_summary(self):
        farmer = self.create_user("+257799555561", "farmer", "Fermier Audit", province="Ngozi")
        buyer = self.create_user("+257799555562", "buyer", "Acheteur Audit", province="Bujumbura")
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799555563",
                name="Admin Audit",
                province="Gitega",
            ),
            db=self.db,
        )
        product = self.create_product(farmer.id, province="Ngozi", price_per_kg=3200)

        farmer.balance = 50000
        self.db.commit()
        self.db.refresh(farmer)

        pending = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number="+257799555569",
            ),
            db=self.db,
        )
        approved = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=18000,
                channel="Ecocash",
                phone_number="+257799555568",
            ),
            db=self.db,
        )
        approved_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(approved["id"].split("-")[1])).one()
        self.main.approve_wallet_withdrawal(
            approved_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Contrôle manuel validé."),
            db=self.db,
        )

        order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=2),
            buyer_id=buyer.id,
            db=self.db,
        )
        dispute = self.main.create_dispute(
            self.schemas.DisputeCreate(
                order_id=order.id,
                reason="Décaissement bloqué",
                detail="Le fermier demande une vérification du flux financier.",
                refund_requested=2500,
                priority="high",
            ),
            db=self.db,
        )
        self.main.review_dispute(
            dispute["dbId"],
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id),
            db=self.db,
        )

        audits = self.main.list_admin_finance_audits(limit=20, db=self.db)
        self.assertGreaterEqual(audits["summary"]["total"], 4)
        self.assertEqual(audits["summary"]["pendingWithdrawalEvents"], 1)
        self.assertTrue(any(
            item["action"] == "WITHDRAWAL_REQUESTED"
            and item["reference"] == pending["id"]
            and item["status"] == "pending"
            for item in audits["items"]
        ))
        self.assertTrue(any(
            item["action"] == "WITHDRAWAL_APPROVED"
            and item["reference"] == approved["id"]
            and item["actorName"] == "Admin Audit"
            for item in audits["items"]
        ))
        self.assertTrue(any(
            item["action"] == "DISPUTE_REVIEWED"
            and item["reference"] == dispute["id"]
            and item["priority"] == "high"
            for item in audits["items"]
        ))

        withdrawal_requested = self.main.list_admin_finance_audits(
            entity_type="withdrawal_request",
            action="WITHDRAWAL_REQUESTED",
            limit=20,
            db=self.db,
        )
        self.assertEqual({item["action"] for item in withdrawal_requested["items"]}, {"WITHDRAWAL_REQUESTED"})
        self.assertEqual(withdrawal_requested["summary"]["disputeEvents"], 0)

        approved_history = self.main.list_admin_finance_audits(
            entity_type="withdrawal_request",
            q=approved["id"],
            limit=20,
            db=self.db,
        )
        self.assertEqual(
            {item["action"] for item in approved_history["items"]},
            {"WITHDRAWAL_REQUESTED", "WITHDRAWAL_APPROVED"},
        )

        limited = self.main.list_admin_finance_audits(limit=1, db=self.db)
        self.assertEqual(len(limited["items"]), 1)
        self.assertGreaterEqual(limited["summary"]["total"], 4)

    def test_wallet_withdrawal_updates_balance_and_maintenance_mode_blocks_orders(self):
        farmer = self.create_user("+257799333331", "farmer", "Fermier Retrait", province="Kayanza")
        buyer = self.create_user("+257799333332", "buyer", "Acheteur Retrait", province="Bujumbura")
        driver = self.create_user("+257799333335", "driver", "Livreur Retrait", province="Kayanza")
        outsider = self.create_user("+257799333333", "buyer", "Acheteur Sans Retrait", province="Ngozi")
        product = self.create_product(farmer.id, province="Kayanza", price_per_kg=4000)
        admin = self.main.create_admin_agent(
            self.schemas.AdminAgentCreate(
                phone_number="+257799333334",
                name="Admin Retrait",
                province="Gitega",
            ),
            db=self.db,
        )

        trusted_order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=1),
            buyer_id=buyer.id,
            db=self.db,
        )
        self.main.pickup_order(trusted_order.id, trusted_order.pickup_qr_token, driver.id, db=self.db)
        self.main.deliver_order(trusted_order.id, trusted_order.delivery_otp, db=self.db)

        farmer.balance = 60000
        self.db.commit()
        self.db.refresh(farmer)

        withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )

        auto_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(withdrawal["id"].split("-")[1])).one()
        auto_approval_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="WITHDRAWAL_APPROVED",
            entity_type="withdrawal_request",
            entity_id=auto_request.id,
        ).one()

        self.assertEqual(withdrawal["status"], "completed")
        self.assertEqual(withdrawal["channel"], "Lumicash")
        self.assertEqual(withdrawal["phone_number"], farmer.phone_number)
        self.assertAlmostEqual(withdrawal["balance"], 48000.0)
        self.assertIn("traité automatiquement", withdrawal["message"])

        self.assertAlmostEqual(auto_request.amount, 12000.0)
        self.assertEqual(auto_request.channel, "Lumicash")
        self.assertEqual(auto_request.phone_number, farmer.phone_number)
        self.assertEqual(auto_request.status, "completed")
        self.assertIsNone(auto_request.processed_by_user_id)
        self.assertIsNotNone(auto_request.processed_at)
        self.assertIn("contrôles de sécurité", auto_request.note)
        self.assertIsNone(auto_approval_audit.admin_user_id)
        self.assertEqual(
            self.db.query(self.models.TransactionLog).filter_by(user_id=farmer.id, action="WITHDRAWAL_REQUEST").count(),
            0,
        )

        second_withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=30000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )
        approved_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(second_withdrawal["id"].split("-")[1])).one()
        self.assertEqual(second_withdrawal["status"], "pending")
        self.assertIn("sous 24h", second_withdrawal["message"])
        self.assertIn("25 000 BIF", second_withdrawal["note"])

        approved = self.main.approve_wallet_withdrawal(
            approved_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Validé au guichet."),
            db=self.db,
        )
        approval_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="WITHDRAWAL_APPROVED",
            entity_type="withdrawal_request",
            entity_id=approved_request.id,
        ).one()

        self.assertEqual(approved["status"], "completed")
        self.assertAlmostEqual(approved["balance"], 18000.0)
        self.assertEqual(approved_request.status, "completed")
        self.assertEqual(approved_request.processed_by_user_id, admin.id)
        self.assertEqual(approved_request.note, "Validé au guichet.")
        self.assertEqual(approval_audit.admin_user_id, admin.id)

        third_withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=10000,
                channel="Lumicash",
                phone_number="+257799333338",
            ),
            db=self.db,
        )
        rejected_request = self.db.query(self.models.WithdrawalRequest).filter(
            self.models.WithdrawalRequest.user_id == farmer.id,
            self.models.WithdrawalRequest.status == "pending",
        ).order_by(self.models.WithdrawalRequest.id.desc()).one()
        rejected = self.main.reject_wallet_withdrawal(
            rejected_request.id,
            payload=self.schemas.AdminActionRequest(admin_user_id=admin.id, note="Numéro non conforme."),
            db=self.db,
        )
        rejected_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=rejected_request.id).one()
        rejection_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="WITHDRAWAL_REJECTED",
            entity_type="withdrawal_request",
            entity_id=rejected_request.id,
        ).one()

        self.assertEqual(third_withdrawal["status"], "pending")
        self.assertIn("numéro principal du compte", third_withdrawal["note"])
        self.assertEqual(rejected["status"], "rejected")
        self.assertAlmostEqual(rejected["balance"], 18000.0)
        self.assertEqual(rejected_request.status, "rejected")
        self.assertEqual(rejected_request.processed_by_user_id, admin.id)
        self.assertEqual(rejected_request.note, "Numéro non conforme.")
        self.assertEqual(rejection_audit.admin_user_id, admin.id)

        with self.assertRaises(HTTPException) as role_error:
            self.main.create_wallet_withdrawal(
                self.schemas.WalletWithdrawalRequest(user_id=outsider.id, amount=12000),
                db=self.db,
            )
        self.assertEqual(role_error.exception.status_code, 400)

        with self.assertRaises(HTTPException) as minimum_error:
            self.main.create_wallet_withdrawal(
                self.schemas.WalletWithdrawalRequest(user_id=farmer.id, amount=5000),
                db=self.db,
            )
        self.assertEqual(minimum_error.exception.status_code, 400)

        with self.assertRaises(HTTPException) as balance_error:
            self.main.create_wallet_withdrawal(
                self.schemas.WalletWithdrawalRequest(user_id=farmer.id, amount=50000),
                db=self.db,
            )
        self.assertEqual(balance_error.exception.status_code, 400)

        self.main.update_admin_settings(
            self.schemas.PlatformSettingsUpdate(maintenance_mode=True),
            db=self.db,
        )
        with self.assertRaises(HTTPException) as maintenance_error:
            self.main.create_order(
                self.schemas.OrderCreate(product_id=product.id, quantity=1),
                buyer_id=buyer.id,
                db=self.db,
            )
        self.assertEqual(maintenance_error.exception.status_code, 503)

        self.main.update_admin_settings(
            self.schemas.PlatformSettingsUpdate(maintenance_mode=False),
            db=self.db,
        )
        order = self.main.create_order(
            self.schemas.OrderCreate(product_id=product.id, quantity=1),
            buyer_id=buyer.id,
            db=self.db,
        )
        self.assertEqual(order.status, self.main.ORDER_STATUS_PAID_ESCROW)

    def test_wallet_withdrawal_routes_new_farmer_to_manual_review_with_reason(self):
        farmer = self.create_user("+257799333341", "farmer", "Nouveau Fermier", province="Ngozi")
        farmer.balance = 20000
        self.db.commit()
        self.db.refresh(farmer)

        withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )

        self.assertEqual(withdrawal["status"], "pending")
        self.assertIn("historique confirmé", withdrawal["message"])
        self.assertIn("sous 24h", withdrawal["note"])

    def test_mock_mobile_money_payout_lifecycle_is_locally_testable(self):
        payout = self.main.create_mock_mobile_money_payout(
            self.schemas.MockMobileMoneyPayoutRequest(
                provider="Lumitel",
                phone_number="+257611223344",
                amount=50000,
                fee_bearer="recipient",
            ),
            db=self.db,
        )

        self.assertEqual(payout["provider"], "Lumicash")
        self.assertEqual(payout["status"], "accepted")
        self.assertEqual(payout["phone_number"], "+257611223344")
        self.assertAlmostEqual(payout["provider_fee"], 500.0)
        self.assertAlmostEqual(payout["tax_amount"], 90.0)
        self.assertAlmostEqual(payout["net_amount"], 49410.0)
        self.assertAlmostEqual(payout["total_debited"], 50000.0)
        self.assertTrue(payout["reference"].startswith("MMP-"))

        fetched = self.main.get_mock_mobile_money_payout(payout["reference"])
        self.assertEqual(fetched["reference"], payout["reference"])
        self.assertEqual(fetched["provider_transaction_id"], payout["provider_transaction_id"])

        completed = self.main.complete_mock_mobile_money_payout(
            payout["reference"],
            payload=self.schemas.MockMobileMoneyStatusUpdateRequest(note="Webhook mock OK."),
            db=self.db,
        )
        self.assertEqual(completed["status"], "completed")
        self.assertIn("Webhook mock OK.", completed["note"])

        with self.assertRaises(HTTPException) as status_error:
            self.main.fail_mock_mobile_money_payout(payout["reference"], db=self.db)
        self.assertEqual(status_error.exception.status_code, 400)

    def test_mock_mobile_money_payout_can_sync_linked_withdrawals(self):
        farmer = self.create_user("+257799333351", "farmer", "Fermier Sandbox", province="Ngozi")
        farmer.balance = 40000
        self.db.commit()
        self.db.refresh(farmer)

        first_withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=12000,
                channel="Lumicash",
                phone_number=farmer.phone_number,
            ),
            db=self.db,
        )
        first_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(first_withdrawal["id"].split("-")[1])).one()
        self.assertEqual(first_request.status, "pending")
        self.assertAlmostEqual(first_request.user.balance, 28000.0)

        first_payout = self.main.create_mock_mobile_money_payout(
            self.schemas.MockMobileMoneyPayoutRequest(withdrawal_id=first_request.id),
            db=self.db,
        )
        self.assertEqual(first_payout["linked_withdrawal_reference"], first_withdrawal["id"])
        self.assertAlmostEqual(first_payout["provider_fee"], 150.0)
        self.assertAlmostEqual(first_payout["tax_amount"], 27.0)
        self.assertAlmostEqual(first_payout["net_amount"], 11823.0)

        completed = self.main.complete_mock_mobile_money_payout(
            first_payout["reference"],
            payload=self.schemas.MockMobileMoneyStatusUpdateRequest(note="Confirmation provider mock."),
            db=self.db,
        )
        refreshed_first_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=first_request.id).one()
        refreshed_farmer = self.db.query(self.models.User).filter_by(id=farmer.id).one()
        approval_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="WITHDRAWAL_APPROVED",
            entity_type="withdrawal_request",
            entity_id=first_request.id,
        ).one()

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(refreshed_first_request.status, "completed")
        self.assertIn(first_payout["reference"], refreshed_first_request.note)
        self.assertIn("Confirmation provider mock.", refreshed_first_request.note)
        self.assertAlmostEqual(refreshed_farmer.balance, 28000.0)
        self.assertIsNone(approval_audit.admin_user_id)

        second_withdrawal = self.main.create_wallet_withdrawal(
            self.schemas.WalletWithdrawalRequest(
                user_id=farmer.id,
                amount=10000,
                channel="Lumicash",
                phone_number="+257799333359",
            ),
            db=self.db,
        )
        second_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=int(second_withdrawal["id"].split("-")[1])).one()
        self.assertEqual(second_request.status, "pending")
        self.assertAlmostEqual(second_request.user.balance, 18000.0)

        second_payout = self.main.create_mock_mobile_money_payout(
            self.schemas.MockMobileMoneyPayoutRequest(
                withdrawal_id=second_request.id,
                provider="EconetLeo",
                fee_bearer="platform",
            ),
            db=self.db,
        )
        self.assertEqual(second_payout["provider"], "Ecocash")
        self.assertAlmostEqual(second_payout["provider_fee"], 200.0)
        self.assertAlmostEqual(second_payout["tax_amount"], 36.0)
        self.assertAlmostEqual(second_payout["net_amount"], 10000.0)
        self.assertAlmostEqual(second_payout["total_debited"], 10236.0)

        failed = self.main.fail_mock_mobile_money_payout(
            second_payout["reference"],
            payload=self.schemas.MockMobileMoneyStatusUpdateRequest(note="Numéro temporairement indisponible."),
            db=self.db,
        )
        refreshed_second_request = self.db.query(self.models.WithdrawalRequest).filter_by(id=second_request.id).one()
        refreshed_farmer = self.db.query(self.models.User).filter_by(id=farmer.id).one()
        rejection_audit = self.db.query(self.models.AdminAuditLog).filter_by(
            action="WITHDRAWAL_REJECTED",
            entity_type="withdrawal_request",
            entity_id=second_request.id,
        ).one()

        self.assertEqual(failed["status"], "failed")
        self.assertEqual(refreshed_second_request.status, "rejected")
        self.assertIn(second_payout["reference"], refreshed_second_request.note)
        self.assertIn("indisponible", refreshed_second_request.note)
        self.assertAlmostEqual(refreshed_farmer.balance, 28000.0)
        self.assertIsNone(rejection_audit.admin_user_id)


if __name__ == "__main__":
    unittest.main()

