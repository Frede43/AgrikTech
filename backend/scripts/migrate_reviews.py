import sqlite3
conn = sqlite3.connect('agriconnect.db')
c = conn.cursor()
try:
    c.execute("""
        CREATE TABLE IF NOT EXISTS product_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            buyer_id INTEGER NOT NULL,
            order_id INTEGER,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (buyer_id) REFERENCES users (id),
            FOREIGN KEY (order_id) REFERENCES orders (id)
        );
    """)
    conn.commit()
    print("Table product_reviews created successfully.")
except Exception as e:
    print(f"Error creating table: {e}")
conn.close()
