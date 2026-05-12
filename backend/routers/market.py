from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db
from backend.services.market_service import market_service

router = APIRouter(
    prefix="/market",
    tags=["Market Price (Soko Live)"]
)

@router.get("/prices")
def get_live_prices(province: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Retourne les prix du marché actualisés.
    Supporte le filtrage par province pour les marchés locaux.
    """
    return market_service.get_live_prices(db, province)
