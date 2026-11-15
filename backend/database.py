import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Déterminer le chemin de la base de données (toujours dans le dossier backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"), override=False)
load_dotenv(override=False)

import backend.config as config

db_path = os.path.join(BASE_DIR, "agriconnect.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{db_path}"

# Fix for Heroku/Render where DATABASE_URL starts with postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if config.IS_PRODUCTION and not DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
    raise RuntimeError("Une base PostgreSQL est requise hors développement/test.")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Pour PostgreSQL et autres
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
