from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, cast
from datetime import datetime, timedelta
from decimal import Decimal

import backend.models as models, backend.schemas as schemas, backend.utils as utils
from backend.database import get_db

router = APIRouter(prefix="/obr", tags=["OBR Compliance"])

@router.get("/report/vat")
def get_vat_report(
    request: Request,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2024),
    province: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Génère un rapport de TVA collectée pour l'OBR.
    Réservé aux administrateurs.
    """
    admin = utils.get_authenticated_user(request, db)
    if not admin or not utils.user_has_role(admin, "admin"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")

    # Définir la plage de dates
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    # Requête de base sur les commandes complétées
    query = db.query(models.Order).filter(
        models.Order.status == "COMPLETED",
        models.Order.created_at >= start_date,
        models.Order.created_at < end_date
    )

    if province:
        query = query.join(models.User, models.Order.farmer_id == models.User.id).filter(models.User.province == province)

    orders = query.all()

    # Agrégation par fermier pour le rapport OBR
    report_data = {}
    total_vat_collected = Decimal("0")
    total_sales_ht = Decimal("0")

    for o in orders:
        farmer = o.farmer
        if not farmer: continue
        
        f_id = farmer.id
        if f_id not in report_data:
            report_data[f_id] = {
                "farmer_name": farmer.name,
                "nif": farmer.nif_number or "NON-ENREGISTRÉ",
                "province": farmer.province,
                "sales_ht": Decimal("0"),
                "vat_collected": Decimal("0"),
                "order_count": 0
            }
        
        report_data[f_id]["sales_ht"] += cast(Decimal, o.subtotal_price) or Decimal("0")
        report_data[f_id]["vat_collected"] += cast(Decimal, o.vat_amount) or Decimal("0")
        report_data[f_id]["order_count"] += 1
        
        total_vat_collected += cast(Decimal, o.vat_amount) or Decimal("0")
        total_sales_ht += cast(Decimal, o.subtotal_price) or Decimal("0")

    return {
        "metadata": {
            "period": f"{month:02d}/{year}",
            "generated_at": datetime.now().isoformat(),
            "total_vat": float(total_vat_collected),
            "total_sales_ht": float(total_sales_ht),
            "currency": "BIF"
        },
        "records": list(report_data.values())
    }

@router.get("/invoices/{order_id}")
def get_obr_invoice_data(order_id: int, db: Session = Depends(get_db)):
    """
    Retourne les données structurées d'une facture pour impression PDF (format OBR).
    """
    order = db.query(models.Order).options(
        joinedload(models.Order.buyer),
        joinedload(models.Order.farmer),
        joinedload(models.Order.items).joinedload(models.OrderItem.product)
    ).filter(models.Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Facture non trouvée.")
        
    return {
        "invoice_number": order.invoice_number,
        "date": order.created_at.isoformat(),
        "buyer": {
            "name": order.buyer.name,
            "address": f"{order.buyer.address}, {order.buyer.province}",
            "phone": order.buyer.phone_number
        },
        "farmer": {
            "name": order.farmer.name,
            "nif": order.farmer.nif_number,
            "address": order.farmer.province
        },
        "items": [
            {
                "product": it.product.name,
                "qty": it.quantity,
                "unit_price": float(it.price_at_order),
                "total": float(it.price_at_order * Decimal(str(it.quantity)))
            } for it in order.items
        ],
        "subtotal": float(cast(Decimal, order.subtotal_price)),
        "vat_amount": float(cast(Decimal, order.vat_amount)),
        "total_ttc": float(cast(Decimal, order.total_price))
    }
