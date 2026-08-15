"""
Crée ou promeut un administrateur AgriConnect.

Utilisation (depuis la racine du projet) :
    python -m backend.create_admin +25776000000 --name "Admin"

Fonctionne avec la base configurée par DATABASE_URL (SQLite ou PostgreSQL).
"""
import argparse
import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine
import backend.models as models


def create_admin(name: str, phone: str) -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.phone_number == phone).first()
        if user:
            if str(user.role) == "admin":
                print(f"L'utilisateur {phone} est déjà un administrateur.")
            else:
                user.role = "admin"
                db.commit()
                print(f"L'utilisateur {phone} a été promu administrateur avec succès.")
        else:
            db.add(models.User(name=name, phone_number=phone, role="admin", is_active=True))
            db.commit()
            print(f"Le nouvel administrateur {name} ({phone}) a été créé avec succès.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Créer ou promouvoir un administrateur AgriConnect.")
    parser.add_argument("phone", type=str, help="Numéro de téléphone (ex: +25776000000)")
    parser.add_argument("--name", type=str, default="Admin", help="Nom de l'administrateur")
    args = parser.parse_args()

    create_admin(args.name, args.phone)
