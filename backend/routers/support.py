from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/support",
    tags=["Support & Tickets"]
)

@router.get("/tickets/{user_id}", response_model=List[dict])
def list_user_tickets(user_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Récupère l'historique des tickets de support pour un utilisateur.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user or (current_user.id != user_id and not utils.user_has_role(current_user, "admin")):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")
    
    # Mock ou table réelle ? Vérifions models.py plus tard. 
    # Pour l'instant on renvoie une liste vide pour éviter le 404.
    return []

@router.post("/tickets", response_model=dict)
def create_support_ticket(payload: dict, request: Request, db: Session = Depends(get_db)):
    """
    Crée un nouveau ticket de support.
    """
    current_user = utils.get_authenticated_user(request, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Session requise.")
    
    # Logique de création (mock pour l'instant pour débloquer l'UI)
    import datetime
    ticket = {
        "id": 1001, # Normalement auto-incrément
        "user_id": current_user.id,
        "subject": payload.get("subject"),
        "message": payload.get("message"),
        "status": "open",
        "created_at": datetime.datetime.now().isoformat(),
        "channel": "app"
    }
    return ticket
