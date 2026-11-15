from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import os, uuid
import math

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db
from backend.services.product_service import product_service
from backend.services import file_storage_service

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

# Configuration temporaire des dossiers (doit être centralisé)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
PRODUCT_IMAGE_MAX_SIZE = 5 * 1024 * 1024

@router.get("", response_model=List[schemas.Product])
@router.get("/", response_model=List[schemas.Product])
def get_products(
    category: Optional[str] = None, 
    province: Optional[str] = None, 
    farmer_id: Optional[int] = None,
    cooperative_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).options(
        joinedload(models.Product.farmer),
        joinedload(models.Product.cooperative)
    ).filter(models.Product.is_active == True)
    
    if category:
        query = query.filter(models.Product.category == category)
    if province:
        query = query.filter(models.Product.province == province)
    if farmer_id:
        query = query.filter(models.Product.farmer_id == farmer_id)
    if cooperative_id:
        query = query.filter(models.Product.cooperative_id == cooperative_id)
        
    return query.offset(skip).limit(limit).all()

@router.get("/{product_id}", response_model=schemas.Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).options(
        joinedload(models.Product.farmer),
        joinedload(models.Product.cooperative)
    ).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return product

@router.get("/trace/{token}", response_model=schemas.Product)
def get_product_by_trace(token: str, db: Session = Depends(get_db)):
    """
    Endpoint public pour la traçabilité.
    Permet de scanner un QR code et de voir la provenance du produit.
    """
    product = db.query(models.Product).options(
        joinedload(models.Product.farmer),
        joinedload(models.Product.cooperative)
    ).filter(models.Product.trace_token == token).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Certificat de traçabilité non trouvé.")
    return product

@router.post("/", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "farmer"):
        raise HTTPException(status_code=403, detail="Réservé aux fermiers.")

    if product.price_per_kg <= 0 or not math.isfinite(product.quantity_kg) or product.quantity_kg < 0:
        raise HTTPException(status_code=400, detail="Prix ou stock invalide.")
    if not math.isfinite(product.min_stock) or product.min_stock < 0:
        raise HTTPException(status_code=400, detail="Seuil de stock invalide.")
    if product.vat_rate < 0 or product.vat_rate > 1:
        raise HTTPException(status_code=400, detail="Taux de TVA invalide.")

    if (product.category or "").strip().lower() in config.RESTRICTED_PRODUCT_CATEGORIES:
        raise HTTPException(
            status_code=403,
            detail="La vente de café/thé est temporairement suspendue sur AgriConnect en attendant clarification du cadre réglementaire (ODECA/OTB).",
        )

    farmer_id = user.id
    trace_token = f"AGRI-{uuid.uuid4().hex[:8].upper()}"

    data = product.model_dump(exclude={"farmer_id", "cooperative_id"})
    db_product = models.Product(
        **data,
        farmer_id=farmer_id,
        cooperative_id=product.cooperative_id,
        trace_token=trace_token,
    )
    db.add(db_product)
    db.flush()

    initial_quantity = float(db_product.quantity_kg or 0)
    product_service.record_stock_movement(
        db, db_product, farmer_id, "initial_stock", initial_quantity, 0.0, initial_quantity, "Stock initial"
    )

    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product_update: schemas.ProductUpdate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "farmer"):
        raise HTTPException(status_code=403, detail="Réservé aux fermiers.")

    farmer_id = user.id
    product = db.query(models.Product).filter(
        models.Product.id == product_id
    ).populate_existing().with_for_update().first()
    if not product or product.farmer_id != farmer_id:
        raise HTTPException(status_code=403, detail="Accès refusé ou produit non trouvé.")

    payload = product_update.model_dump(exclude_unset=True)
    if str(payload.get("category", "")).strip().lower() in config.RESTRICTED_PRODUCT_CATEGORIES:
        raise HTTPException(
            status_code=403,
            detail="La vente de café/thé est temporairement suspendue sur AgriConnect en attendant clarification du cadre réglementaire (ODECA/OTB).",
        )
    if "price_per_kg" in payload and (payload["price_per_kg"] is None or float(payload["price_per_kg"]) <= 0):
        raise HTTPException(status_code=400, detail="Le prix doit être positif.")
    if "quantity_kg" in payload and payload["quantity_kg"] is not None:
        if not math.isfinite(float(payload["quantity_kg"])) or float(payload["quantity_kg"]) < 0:
            raise HTTPException(status_code=400, detail="Le stock doit être un nombre positif ou nul.")
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
def delete_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "farmer"):
        raise HTTPException(status_code=403, detail="Réservé aux fermiers.")

    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.farmer_id == user.id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé.")

    # Refuser la suppression si le produit a déjà été commandé : la ligne de
    # commande (OrderItem.product_id) doit rester traçable, et une tentative
    # de suppression aurait de toute façon échoué en base avec une erreur 500
    # (contrainte de clé étrangère) plutôt qu'un message clair.
    has_order_history = db.query(models.OrderItem.id).filter(
        models.OrderItem.product_id == product_id
    ).first() is not None
    if has_order_history:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer ce produit : il a déjà été commandé. Désactivez-le plutôt.",
        )

    db.delete(product)
    db.commit()

@router.post("/{product_id}/upload-image/")
async def upload_product_image(product_id: int, request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user or not utils.user_has_role(user, "farmer"):
        raise HTTPException(status_code=403, detail="Réservé aux fermiers.")
    if config.IS_PRODUCTION and not file_storage_service.is_imagekit_configured():
        raise HTTPException(status_code=503, detail="Le stockage des images produit n'est pas configuré.")

    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.farmer_id != user.id:
        raise HTTPException(status_code=404, detail="Produit non trouvé.")

    contents = await file.read(PRODUCT_IMAGE_MAX_SIZE + 1)
    if len(contents) > PRODUCT_IMAGE_MAX_SIZE:
        raise HTTPException(status_code=413, detail="Image trop volumineuse (5 Mo maximum).")

    image_types = (
        ("image/jpeg", "jpg", contents.startswith(b"\xff\xd8\xff")),
        ("image/png", "png", contents.startswith(b"\x89PNG\r\n\x1a\n")),
        ("image/webp", "webp", len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP"),
    )
    detected = next((kind for kind in image_types if kind[2]), None)
    if not detected:
        raise HTTPException(status_code=400, detail="Formats autorisés : JPEG, PNG ou WebP.")

    image_url = file_storage_service.store_uploaded_file(
        contents,
        f"photo.{detected[1]}",
        prefix=f"prod_{product_id}",
        folder="/products/",
        local_dir=UPLOAD_DIR,
        local_url_prefix="/static/uploads",
    )

    product.image_url = image_url
    db.commit()
    return {"image_url": product.image_url}
