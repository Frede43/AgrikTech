from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/cooperatives",
    tags=["Cooperatives"]
)

@router.get("/", response_model=List[schemas.Cooperative])
def get_cooperatives(province: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Cooperative)
    if province:
        query = query.filter(models.Cooperative.province == province)
    return query.all()

@router.post("/", response_model=schemas.Cooperative)
def create_cooperative(coop: schemas.CooperativeCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    # SECURITE : Seul un fermier peut créer une coopérative
    if user.role != "fermier":
        raise HTTPException(status_code=403, detail="Seuls les fermiers peuvent créer une coopérative.")
    
    # Vérifier si l'utilisateur est déjà dans une coop
    if user.cooperative_id:
        raise HTTPException(status_code=400, detail="Vous êtes déjà membre d'une coopérative.")

    # Vérifier l'unicité du nom
    existing = db.query(models.Cooperative).filter(models.Cooperative.name == coop.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Une coopérative avec ce nom existe déjà.")
    
    db_coop = models.Cooperative(**coop.model_dump())
    db.add(db_coop)
    db.commit()
    db.refresh(db_coop)
    
    # L'utilisateur devient membre automatiquement
    user.cooperative_id = db_coop.id
    db.commit()
    
    return db_coop

@router.post("/{coop_id}/join")
def join_cooperative(coop_id: int, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    if user.role != "fermier":
        raise HTTPException(status_code=403, detail="Seuls les fermiers peuvent rejoindre une coopérative.")

    if user.cooperative_id:
        raise HTTPException(status_code=400, detail="Vous êtes déjà membre d'une coopérative. Quittez d'abord la vôtre.")
    
    coop = db.query(models.Cooperative).filter(models.Cooperative.id == coop_id).first()
    if not coop: raise HTTPException(status_code=404, detail="Coopérative non trouvée.")
    
    user.cooperative_id = coop.id
    db.commit()
    return {"message": f"Vous avez rejoint la coopérative {coop.name}"}

@router.post("/leave")
def leave_cooperative(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    user.cooperative_id = None
    db.commit()
    return {"message": "Vous avez quitté la coopérative"}

@router.get("/{coop_id}/members", response_model=List[dict])
def get_cooperative_members(coop_id: int, db: Session = Depends(get_db)):
    members = db.query(models.User).filter(models.User.cooperative_id == coop_id).all()
    return [{"id": m.id, "name": m.name, "role": m.role} for m in members]

@router.post("/{coop_id}/products", response_model=schemas.Product)
def create_cooperative_product(coop_id: int, product: schemas.ProductCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    coop = db.query(models.Cooperative).filter(models.Cooperative.id == coop_id).first()
    if not coop: raise HTTPException(status_code=404)
    
    # Vérifier si l'utilisateur est membre de cette coop
    if user.cooperative_id != coop_id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à vendre pour cette coopérative.")
    
    db_product = models.Product(**product.model_dump(), cooperative_id=coop_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/{coop_id}/products", response_model=List[schemas.Product])
def get_cooperative_products(coop_id: int, db: Session = Depends(get_db)):
    return db.query(models.Product).options(joinedload(models.Product.cooperative)).filter(models.Product.cooperative_id == coop_id).all()
