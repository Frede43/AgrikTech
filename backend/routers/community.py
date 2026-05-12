from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

import backend.models as models, backend.schemas as schemas, backend.config as config, backend.utils as utils
from backend.database import get_db

router = APIRouter(
    prefix="/community",
    tags=["Community & Support"]
)

@router.get("/testimonials", response_model=List[schemas.Testimonial])
def get_testimonials(db: Session = Depends(get_db)):
    return db.query(models.Testimonial).all()

@router.post("/support", response_model=schemas.SupportTicket)
def create_support_ticket(ticket: schemas.SupportTicketCreate, request: Request, db: Session = Depends(get_db)):
    user = utils.get_authenticated_user(request, db)
    # Support can be anonymous or logged in
    db_ticket = models.SupportTicket(
        user_id=user.id if user else None,
        phone_number=ticket.phone_number,
        subject=ticket.subject,
        message=ticket.message,
        status="open"
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket
