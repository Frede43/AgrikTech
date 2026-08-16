from sqlalchemy.orm import Session
from fastapi import HTTPException
import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils

def persist_user(user: schemas.UserCreate, db: Session, *, is_admin_context: bool = False) -> models.User:
    phone_number = user.phone_number

    # Check if already exists
    db_user_exists = db.query(models.User).filter(models.User.phone_number == phone_number).first()
    if db_user_exists:
        raise HTTPException(status_code=400, detail="Ce numéro est déjà enregistré.")

    # Normaliser le rôle
    normalized_role = utils.normalize_role(user.role)
    if not normalized_role:
        raise HTTPException(status_code=400, detail="Rôle utilisateur invalide")
    # admin / obr / ministere_agriculture : jamais via l'inscription publique,
    # uniquement par un admin déjà authentifié (is_admin_context=True, réglé
    # par les appelants qui ont déjà vérifié user_has_role(..., "admin")).
    restricted_roles = {"admin", *config.GOVERNMENT_ROLE_VALUES}
    if normalized_role in restricted_roles and not is_admin_context:
        raise HTTPException(status_code=403, detail="Ce rôle ne peut être attribué que par un administrateur.")

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
