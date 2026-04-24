from database import SessionLocal
import models
from database import engine

def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Create a Farmer
    farmer = db.query(models.User).filter(models.User.phone_number == "+25776000000").first()
    if not farmer:
        farmer = models.User(
            phone_number="+25776000000",
            role="fermier",
            name="Pascal N.",
            province="Kayanza",
            balance=150000.0
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)
        print(f"Created farmer: {farmer.name}")

    # 2. Create products for the farmer
    products_count = db.query(models.Product).count()
    if products_count == 0:
        products = [
            models.Product(name="Haricots Jaunes", category="legumes", price_per_kg=2500, unit="kg", quantity_kg=100, province="Kayanza", farmer_id=farmer.id),
            models.Product(name="Tomates Fraîches", category="legumes", price_per_kg=1800, unit="kg", quantity_kg=50, province="Kayanza", farmer_id=farmer.id),
            models.Product(name="Café Arabica", category="export", price_per_kg=15000, unit="kg", quantity_kg=20, province="Kayanza", farmer_id=farmer.id),
        ]
        db.add_all(products)
        db.commit()
        print(f"Added {len(products)} products.")

    # 3. Create a Buyer
    buyer = db.query(models.User).filter(models.User.phone_number == "+25779123456").first()
    if not buyer:
        buyer = models.User(
            phone_number="+25779123456",
            role="acheteur",
            name="Hôtel Source du Nil",
            province="Bujumbura",
            balance=1000000.0
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        print(f"Created buyer: {buyer.name}")

    # 4. Create a Driver
    driver = db.query(models.User).filter(models.User.phone_number == "+25771222333").first()
    if not driver:
        driver = models.User(
            phone_number="+25771222333",
            role="logistique",
            name="Nestor",
            province="Bujumbura",
            balance=50000.0
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)
        print(f"Created driver: {driver.name}")

    db.close()

if __name__ == "__main__":
    seed()
