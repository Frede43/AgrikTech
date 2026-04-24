from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas, utils
from database import get_db

router = APIRouter(
    prefix="/testimonials",
    tags=["Testimonials"]
)

@router.get("", response_model=List[schemas.Testimonial])
@router.get("/", response_model=List[schemas.Testimonial])
def list_testimonials(db: Session = Depends(get_db)):
    """
    Liste tous les témoignages approuvés pour la page d'accueil.
    """
    return db.query(models.Testimonial).filter(models.Testimonial.status == "approved").all()

@router.get("/me", response_model=List[schemas.Testimonial])
def get_my_testimonials(request: Request, db: Session = Depends(get_db)):
    """
    Récupère l'historique des témoignages de l'utilisateur connecté.
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise")
        
    return db.query(models.Testimonial).filter(models.Testimonial.user_id == user.id).all()

@router.post("", response_model=schemas.Testimonial)
@router.post("/", response_model=schemas.Testimonial)
def submit_testimonial(payload: schemas.TestimonialCreate, request: Request, db: Session = Depends(get_db)):
    """
    Permet à un utilisateur de soumettre un nouveau témoignage (en attente de validation).
    """
    user = utils.get_authenticated_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Session requise")

    db_testimonial = models.Testimonial(
        user_id=user.id,
        author_name=user.name,
        author_role_fr=user.role, # Sera traduit ou enrichi par admin
        author_role_ki=user.role, 
        quote_fr=payload.message,
        rating=payload.rating,
        status="pending",
        location=f"{user.commune}, {user.province}" if user.province else None
    )
    
    db.add(db_testimonial)
    db.commit()
    db.refresh(db_testimonial)
    return db_testimonial
