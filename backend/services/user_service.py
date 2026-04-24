from sqlalchemy.orm import Session
from fastapi import HTTPException
import models, schemas, config, utils

def persist_user(user: schemas.UserCreate, db: Session) -> models.User:
    phone_number = user.phone_number
    
    # Check if already exists
    db_user_exists = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if db_user_exists:
        raise HTTPException(status_code=400, detail="Ce numéro est déjà enregistré.")

    # Normaliser le rôle
    normalized_role = utils.normalize_role(user.role)
    if not normalized_role:
        raise HTTPException(status_code=400, detail="Rôle utilisateur invalide")
    if normalized_role == "admin":
        raise HTTPException(status_code=403, detail="La création d'un administrateur n'est pas autorisée via l'inscription publique.")

    # Sanitize payload
    payload = utils.sanitize_user_update_payload(user.model_dump())
    payload["role"] = normalized_role
    
    # Create user
    db_user = models.User(**payload)
    db.add(db_user)
    
    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'utilisateur: {str(e)}")
        
    return db_user
