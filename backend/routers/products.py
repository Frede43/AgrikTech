from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os, uuid, shutil

import models, schemas, config, utils
from database import get_db
from services.product_service import product_service

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

# Configuration temporaire des dossiers (doit être centralisé)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")

@router.get("", response_model=List[schemas.Product])
@router.get("/", response_model=List[schemas.Product])
def get_products(
    category: Optional[str] = None, 
    province: Optional[str] = None, 
    farmer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).options(joinedload(models.Product.farmer))
    if category:
        query = query.filter(models.Product.category == category)
    if province:
        query = query.filter(models.Product.province == province)
    if farmer_id:
        query = query.filter(models.Product.farmer_id == farmer_id)
        
    return query.offset(skip).limit(limit).all()

@router.get("/{product_id}", response_model=schemas.Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).options(joinedload(models.Product.farmer)).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return product

@router.post("/", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, farmer_id: int, db: Session = Depends(get_db)):
    farmer = db.query(models.User).filter(models.User.id == farmer_id).first()
    if not utils.user_has_role(farmer, "fermier"):
        raise HTTPException(status_code=400, detail="Fermier invalide ou rôle incorrect")
        
    db_product = models.Product(**product.model_dump(), farmer_id=farmer_id)
    db.add(db_product)
    db.flush()
    
    # Record Initial Stock
    initial_quantity = float(db_product.quantity_kg or 0)
    product_service.record_stock_movement(
        db, db_product, farmer_id, "initial_stock", initial_quantity, 0.0, initial_quantity, "Stock initial"
    )
    
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product_update: schemas.ProductUpdate, farmer_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.farmer_id != farmer_id:
        raise HTTPException(status_code=403, detail="Accès refusé ou produit non trouvé")

    payload = product_update.model_dump(exclude_unset=True)
    stock_reason_code = payload.pop("stock_reason_code", None)
    stock_reason_note = payload.pop("stock_reason_note", None)
    
    quantity_before = float(product.quantity_kg or 0)
    
    if "quantity_kg" in payload and payload["quantity_kg"] is not None:
        quantity_after = float(payload["quantity_kg"])
        mtype, mreason = product_service.describe_stock_adjustment(quantity_before, quantity_after, stock_reason_code, stock_reason_note)
        product_service.record_stock_movement(db, product, farmer_id, mtype, quantity_after - quantity_before, quantity_before, quantity_after, mreason)

    for field, value in payload.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, farmer_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.farmer_id == farmer_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    db.delete(product)
    db.commit()

@router.post("/{product_id}/upload-image/")
async def upload_product_image(product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product: raise HTTPException(status_code=404)
    
    if not os.path.exists(UPLOAD_DIR): os.makedirs(UPLOAD_DIR)
        
    filename = f"prod_{product_id}_{uuid.uuid4().hex[:6]}.{file.filename.split('.')[-1]}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    product.image_url = f"/static/uploads/{filename}"
    db.commit()
    return {"image_url": product.image_url}
