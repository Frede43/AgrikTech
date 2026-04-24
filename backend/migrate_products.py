import sqlite3
conn = sqlite3.connect('agriconnect.db')
c = conn.cursor()
try:
    c.execute("ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1;")
    conn.commit()
    print("Column is_active added to products table.")
except sqlite3.OperationalError:
    print("Column is_active might already exist.")
conn.close()
