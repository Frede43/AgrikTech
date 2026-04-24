import sqlite3
conn = sqlite3.connect('agriconnect.db')
c = conn.cursor()
try:
    c.execute("""
        CREATE TABLE IF NOT EXISTS logistics_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id INTEGER NOT NULL,
            buyer_id INTEGER NOT NULL,
            order_id INTEGER NOT NULL UNIQUE,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (driver_id) REFERENCES users (id),
            FOREIGN KEY (buyer_id) REFERENCES users (id),
            FOREIGN KEY (order_id) REFERENCES orders (id)
        );
    """)
    conn.commit()
    print("Table logistics_reviews created successfully.")
except Exception as e:
    print(f"Error creating table: {e}")
conn.close()
