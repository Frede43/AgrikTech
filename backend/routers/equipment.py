from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(prefix="/equipment", tags=["Equipment"])

@router.get("/", response_model=List[schemas.Equipment])
def get_equipment(province: Optional[str] = None, type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Equipment).filter(models.Equipment.is_available == True)
    if province:
        query = query.filter(models.Equipment.province == province)
    if type:
        query = query.filter(models.Equipment.type == type)
    return query.all()

@router.post("/", response_model=schemas.Equipment)
def create_equipment(eq: schemas.EquipmentCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    db_eq = models.Equipment(**eq.model_dump())
    db.add(db_eq)
    db.commit()
    db.refresh(db_eq)
    return db_eq

@router.post("/{equipment_id}/reserve", response_model=schemas.EquipmentReservation)
def reserve_equipment(equipment_id: int, reservation: schemas.EquipmentReservationCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)

    equipment = db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()
    if not equipment: raise HTTPException(status_code=404, detail="Équipement non trouvé.")
    if not equipment.is_available: raise HTTPException(status_code=400, detail="Équipement non disponible.")

    # Calcul durée et prix
    delta = (reservation.end_date - reservation.start_date).days
    if delta <= 0: raise HTTPException(status_code=400, detail="Dates invalides.")
    total = equipment.price_per_day * delta

    db_res = models.EquipmentReservation(
        equipment_id=equipment_id,
        user_id=user.id,
        start_date=reservation.start_date,
        end_date=reservation.end_date,
        total_price=total,
        status="pending"
    )
    equipment.is_available = False
    db.add(db_res)
    db.commit()
    db.refresh(db_res)
    return db_res

@router.get("/reservations/me")
def my_reservations(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    res = db.query(models.EquipmentReservation).filter(models.EquipmentReservation.user_id == user.id).all()
    return res
