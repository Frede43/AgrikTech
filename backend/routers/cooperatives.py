from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

import backend.models as models, backend.schemas as schemas, backend.utils as utils, backend.config as config
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

    if (product.category or "").strip().lower() in config.RESTRICTED_PRODUCT_CATEGORIES:
        raise HTTPException(
            status_code=403,
            detail="La vente de café/thé est temporairement suspendue sur AgriConnect en attendant clarification du cadre réglementaire (ODECA/OTB).",
        )

    # exclude=cooperative_id/farmer_id : ProductCreate en porte déjà (hérités
    # de ProductBase, généralement None côté client), il ne faut pas les
    # dupliquer avec les valeurs, faisant autorité, calculées ici.
    #
    # farmer_id = le membre qui publie : c'est LUI qui reçoit l'argent à la
    # livraison (release_funds_to_farmer crédite order.farmer_id — il n'existe
    # aucun solde propre à une Cooperative). cooperative_id reste renseigné
    # pour l'affichage : Product.seller_name priorise le nom de la coopérative
    # dès que cooperative_id est défini, quel que soit farmer_id.
    db_product = models.Product(
        **product.model_dump(exclude={"cooperative_id", "farmer_id"}),
        cooperative_id=coop_id,
        farmer_id=user.id,
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/{coop_id}/products", response_model=List[schemas.Product])
def get_cooperative_products(coop_id: int, db: Session = Depends(get_db)):
    return db.query(models.Product).options(joinedload(models.Product.cooperative)).filter(models.Product.cooperative_id == coop_id).all()

@router.get("/{coop_id}/stats")
def get_cooperative_stats(coop_id: int, db: Session = Depends(get_db)):
    coop = db.query(models.Cooperative).filter(models.Cooperative.id == coop_id).first()
    if not coop:
        raise HTTPException(status_code=404, detail="Coopérative non trouvée.")

    total_stock_kg = db.query(func.sum(models.Product.quantity_kg)).filter(
        models.Product.cooperative_id == coop_id,
        models.Product.is_active == True,
    ).scalar() or 0.0

    # Ventes réelles : on part des lignes de commande (OrderItem.price_at_order,
    # figé au moment de l'achat) plutôt que du prix courant du produit, qui a pu
    # changer depuis — et on ne compte que les commandes réellement abouties.
    sales_rows = db.query(models.OrderItem.price_at_order, models.OrderItem.quantity).join(
        models.Product, models.OrderItem.product_id == models.Product.id
    ).join(
        models.Order, models.OrderItem.order_id == models.Order.id
    ).filter(
        models.Product.cooperative_id == coop_id,
        models.Order.status == "COMPLETED",
    ).all()
    total_sales = sum(float(price) * float(quantity) for price, quantity in sales_rows)

    return {
        "total_stock_kg": float(total_stock_kg),
        "total_sales": total_sales,
    }
