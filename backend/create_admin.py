import sqlite3
import argparse
from datetime import datetime

def create_admin(name, phone):
    conn = sqlite3.connect('agriconnect.db')
    cur = conn.cursor()
    
    # Check if user already exists
    cur.execute("SELECT id, role FROM users WHERE phone_number = ?", (phone,))
    user = cur.fetchone()
    
    if user:
        if user[1] == 'admin':
            print(f"L'utilisateur {phone} est déjà un administrateur.")
        else:
            cur.execute("UPDATE users SET role = 'admin' WHERE id = ?", (user[0],))
            print(f"L'utilisateur {phone} a été promu administrateur avec succès.")
    else:
        # Create new admin user
        cur.execute(
            "INSERT INTO users (name, phone_number, role, is_active) VALUES (?, ?, 'admin', 1)",
            (name, phone)
        )
        print(f"Le nouvel administrateur {name} ({phone}) a été créé avec succès.")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Créer ou promouvoir un administrateur AgriConnect.")
    parser.add_argument("phone", type=str, help="Numéro de téléphone (ex: +25776000000)")
    parser.add_argument("--name", type=str, default="Admin", help="Nom de l'administrateur")
    args = parser.parse_args()
    
    create_admin(args.name, args.phone)
