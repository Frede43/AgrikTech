from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/categories",
    tags=["Categories"]
)

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_categories(db: Session = Depends(get_db)):
    print("DEBUG: /categories root reached")
    """
    Retourne la liste des catégories de produits avec le nombre d'articles en stock.
    Note: Utilise les icônes standards pour l'affichage Burundi.
    """
    query = (
        db.query(
            models.Product.category.label("id"),
            func.count(models.Product.id).label("count")
        )
        .group_by(models.Product.category)
        .all()
    )
    
    # Mapping Icônes & Labels pour le Burundi
    CATEGORY_META = {
        "legumes": {"label": "Légumes", "icon": "🥦"},
        "tubercules": {"label": "Tubercules", "icon": "🥔"},
        "cereales": {"label": "Céréales", "icon": "🌽"},
        "fruits": {"label": "Fruits", "icon": "🍌"},
        "export": {"label": "Export (Café/Thé)", "icon": "☕"},
        "autres": {"label": "Autres", "icon": "📦"}
    }
    
    results = []
    for cat_id, count in query:
        cid = str(cat_id).lower()
        meta = CATEGORY_META.get(cid, CATEGORY_META["autres"])
        results.append({
            "id": cid,
            "label": meta["label"],
            "icon": meta["icon"],
            "count": count
        })
    
    # Si vide, on renvoie les catégories par défaut avec count=0
    if not results:
        for cid, meta in CATEGORY_META.items():
            results.append({
                "id": cid,
                "label": meta["label"],
                "icon": meta["icon"],
                "count": 0
            })
            
    return results
