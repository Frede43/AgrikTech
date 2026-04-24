import sqlite3
conn = sqlite3.connect('agriconnect.db')
conn.row_factory = sqlite3.Row
orders = conn.execute('SELECT id, status, driver_id, buyer_id, farmer_id FROM orders').fetchall()
for o in orders:
    print(dict(o))
