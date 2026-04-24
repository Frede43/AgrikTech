try:
    from database import engine, SessionLocal
    import models
    from sqlalchemy.orm import Session
    import traceback
    
    print("Models imported correctly.")
    models.Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")
    
    db = SessionLocal()
    print("Session opened.")
    
    count = db.query(models.Product).count()
    print(f"Product count: {count}")
    
    db.close()
except Exception as e:
    traceback.print_exc()
