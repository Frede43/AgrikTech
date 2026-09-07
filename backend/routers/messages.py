from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("/", response_model=List[schemas.Message])
def get_inbox(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    # Envoyés ET reçus : le front reconstruit des fils de discussion à deux
    # sens (voir app/*/messages/page.tsx, qui regroupe par sender_id/receiver_id
    # opposé à l'utilisateur courant) — se limiter à receiver_id rendait
    # invisibles les messages qu'on envoie soi-même, y compris toute
    # conversation qu'on démarre tant que l'autre partie n'a pas répondu.
    msgs = (
        db.query(models.Message)
        .filter(or_(models.Message.receiver_id == user.id, models.Message.sender_id == user.id))
        .order_by(models.Message.created_at.desc())
        .all()
    )

    # Le frontend affichait "Fermier #12" / "Acheteur #12" faute de nom —
    # on résout les noms ici en une seule requête plutôt que d'exposer un
    # sender_id/receiver_id brut que le client ne peut pas traduire lui-même.
    user_ids = {m.sender_id for m in msgs} | {m.receiver_id for m in msgs}
    names = {}
    if user_ids:
        rows = db.query(models.User.id, models.User.name).filter(models.User.id.in_(user_ids)).all()
        names = {row[0]: row[1] for row in rows}
    for m in msgs:
        m.sender_name = names.get(m.sender_id)
        m.receiver_name = names.get(m.receiver_id)

    return msgs

@router.post("/", response_model=schemas.Message)
def send_message(msg: schemas.MessageCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    receiver = db.query(models.User).filter(models.User.id == msg.receiver_id).first()
    if not receiver: raise HTTPException(status_code=404, detail="Destinataire non trouvé.")
    
    db_msg = models.Message(
        sender_id=user.id,
        receiver_id=msg.receiver_id,
        order_id=msg.order_id,
        content=msg.content
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg

@router.put("/{message_id}/read")
def mark_as_read(message_id: int, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    
    msg = db.query(models.Message).filter(
        models.Message.id == message_id,
        models.Message.receiver_id == user.id
    ).first()
    if not msg: raise HTTPException(status_code=404)
    
    msg.read_at = utils.utcnow_naive()
    db.commit()
    return {"message": "Lu"}

@router.get("/unread/count")
def unread_count(request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    if not user: raise HTTPException(status_code=401)
    count = db.query(models.Message).filter(
        models.Message.receiver_id == user.id,
        models.Message.read_at == None
    ).count()
    return {"unread": count}
