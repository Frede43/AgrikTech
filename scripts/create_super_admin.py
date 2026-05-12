import sys
import os

# Ajoute le dossier parent au path pour importer les modules du backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import User
from decimal import Decimal

def create_super_admin(name="Super Admin", phone="+25770000000"):
    db = SessionLocal()
    try:
        # Vérifie si l'utilisateur existe déjà
        user = db.query(User).filter(User.phone_number == phone).first()
        if user:
            print(f"L'utilisateur {phone} existe déjà (Rôle: {user.role}). Mise à jour en admin...")
            user.role = "admin"
            user.name = name
            db.commit()
            print("Mise à jour réussie.")
        else:
            print(f"Création du Super Admin {name} ({phone})...")
            new_user = User(
                phone_number=phone,
                name=name,
                role="admin",
                province="Bujumbura",
                is_active=True,
                balance=Decimal("0.0")
            )
            db.add(new_user)
            db.commit()
            print("Super Admin créé avec succès !")
    except Exception as e:
        print(f"Erreur lors de la création: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Paramètres par défaut ou via ligne de commande
    name = sys.argv[1] if len(sys.argv) > 1 else "Super Admin"
    phone = sys.argv[2] if len(sys.argv) > 2 else "+25770000000"
    create_super_admin(name, phone)
