from fastapi import HTTPException, Response, Request
from sqlalchemy.orm import Session
import secrets
from typing import Optional, cast
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

import backend.models as models, backend.schemas as schemas, backend.config as config

def utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

def normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    return config.ROLE_ALIASES.get(role.strip().lower())

def user_has_role(user: Optional[models.User], *roles: str) -> bool:
    if not user:
        return False
    normalized_role = normalize_role(cast(str, user.role))
    normalized_targets = {normalize_role(role) for role in roles}
    return normalized_role is not None and normalized_role in normalized_targets

def create_session_token() -> str:
    return secrets.token_urlsafe(32)

def build_auth_session_payload(user: models.User) -> schemas.AuthSession:
    normalized_role = normalize_role(cast(str, user.role))
    if not normalized_role:
        raise HTTPException(status_code=500, detail="Rôle utilisateur invalide en session")
    return schemas.AuthSession(user_id=cast(int, user.id), role=normalized_role)

def set_authenticated_session(response: Response, user: models.User, db: Session) -> schemas.AuthSession:
    payload = build_auth_session_payload(user)
    session_token = create_session_token()
    
    now = utcnow_naive()
    expires_at = now + timedelta(seconds=config.SESSION_MAX_AGE)
    db_session = models.PersistentSession(
        id=session_token,
        user_id=user.id,
        role=payload.role,
        expires_at=expires_at
    )
    db.add(db_session)
    db.commit()
    
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=session_token,
        max_age=config.SESSION_MAX_AGE,
        httponly=True,
        samesite=config.SESSION_SAMESITE,
        secure=config.SESSION_HTTPS_ONLY,
        path="/",
    )
    return payload

def clear_authenticated_session(request: Request, db: Session, response: Optional[Response] = None):
    session_token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if session_token:
        db.query(models.PersistentSession).filter(models.PersistentSession.id == session_token).delete()
        db.commit()
        
    if response is not None:
        response.delete_cookie(
            key=config.SESSION_COOKIE_NAME,
            httponly=True,
            samesite=config.SESSION_SAMESITE,
            secure=config.SESSION_HTTPS_ONLY,
            path="/",
        )

def get_authenticated_user(request: Request, db: Session) -> Optional[models.User]:
    session_token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if not session_token:
        return None

    persistent_session = db.query(models.PersistentSession).filter(
        models.PersistentSession.id == session_token,
        models.PersistentSession.expires_at > utcnow_naive()
    ).first()
    
    if not persistent_session:
        return None

    user = db.query(models.User).filter(models.User.id == persistent_session.user_id).first()
    if not user or not user.is_active:
        clear_authenticated_session(request, db)
        return None

    if normalize_role(cast(str, user.role)) != persistent_session.role:
        clear_authenticated_session(request, db)
        return None

    return user

def sanitize_user_update_payload(payload: dict) -> dict:
    sanitized = {}
    for key, value in payload.items():
        if isinstance(value, str):
            trimmed = value.strip()
            sanitized[key] = trimmed or None
        else:
            sanitized[key] = value
    return sanitized

def validate_user_update_payload(user: models.User, payload: dict, db: Session) -> dict:
    if "phone_number" in payload:
        phone_number = payload["phone_number"]
        if not phone_number:
            raise HTTPException(status_code=400, detail="Le numéro de téléphone ne peut pas être vide.")
        existing_user = db.query(models.User).filter(
            models.User.phone_number == phone_number,
            models.User.id != user.id,
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Ce numéro est déjà enregistré.")

    if "role" in payload:
        normalized_role = normalize_role(payload["role"])
        if not normalized_role:
            raise HTTPException(status_code=400, detail="Rôle utilisateur invalide")
        if normalized_role == "admin" and not user_has_role(user, "admin"):
            raise HTTPException(
                status_code=400,
                detail="La création ou promotion d'un administrateur doit passer par les paramètres admin.",
            )
        if user_has_role(user, "admin") and normalized_role != normalize_role(cast(str, user.role)):
            raise HTTPException(status_code=400, detail="Le rôle des administrateurs ne peut pas être modifié ici")
        payload["role"] = normalized_role

    if (
        "is_active" in payload
        and payload["is_active"] != user.is_active
        and user_has_role(user, "admin")
    ):
        raise HTTPException(status_code=400, detail="Le statut des administrateurs ne peut pas être modifié ici")

    return payload


# --- Formatting & Logic Helpers ---

def format_order_reference(order_id: int) -> str:
    return f"CMD-{order_id:05d}"

def serialize_order_status(status: str) -> str:
    return status.replace("_", " ").capitalize()

def format_user_location(user: Optional[models.User]) -> str:
    if not user: return "N/A"
    parts = [cast(str, p) for p in [user.address, user.commune, user.province] if p]
    return ", ".join(parts) or "Localisation inconnue"

def calculate_distance_km(u1: Optional[models.User], u2: Optional[models.User]) -> float:
    if not u1 or not u2 or u1.latitude is None or u1.longitude is None or u2.latitude is None or u2.longitude is None:
        return 0.0
    
    # Haversine formula
    lon1, lat1, lon2, lat2 = map(radians, [cast(float, u1.longitude), cast(float, u1.latitude), cast(float, u2.longitude), cast(float, u2.latitude)])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return 6371 * c # Rayon de la Terre en km

def calculate_road_distance_km_sync(u1: Optional[models.User], u2: Optional[models.User]) -> Optional[float]:
    """
    Version synchrone pour intégration facile dans les fonctions existantes.
    Utilise OpenRouteService si la clé est présente.
    """
    import httpx
    if not config.ORS_API_KEY: return None
    if not u1 or not u2 or u1.latitude is None or u2.latitude is None: return None
    
    # ORS attend [longitude, latitude]
    start = [u1.longitude, u1.latitude]
    end = [u2.longitude, u2.latitude]
    
    url = "https://api.openrouteservice.org/v2/directions/driving-car/json"
    headers = {"Authorization": config.ORS_API_KEY, "Content-Type": "application/json"}
    body = {"coordinates": [start, end], "units": "m"}
    
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.post(url, json=body, headers=headers)
            if response.status_code == 200:
                return response.json()["routes"][0]["summary"]["distance"] / 1000.0
    except:
        pass
    return None

def get_standard_commission_rate(db: Session) -> Decimal:
    """
    Taux de commission "hors promo" — modifiable par un admin depuis
    Admin > Paramètres (SystemSettings.commission_rate), sans déploiement.
    Avant ce correctif, ce champ se sauvegardait sans effet réel : le calcul
    de commission lisait uniquement config.DEFAULT_COMMISSION_RATE, jamais
    la base — un admin pouvait "enregistrer" une nouvelle valeur qui ne
    changeait jamais rien sur les commandes.

    Repli sur DEFAULT_COMMISSION_RATE tant qu'aucune ligne SystemSettings
    n'existe encore (elle n'est créée qu'au premier GET /admin/settings).
    """
    settings = db.query(models.SystemSettings).first()
    if settings and settings.commission_rate is not None:
        return Decimal(str(settings.commission_rate))
    return config.DEFAULT_COMMISSION_RATE

def compute_delivery_fee(buyer: Optional[models.User], farmer: Optional[models.User]) -> Decimal:
    """
    Frais de livraison facturé à l'acheteur, versé en intégralité au livreur
    à la livraison (voir payment_service.release_delivery_fee_to_driver).

    Repli sur un forfait par province (LOGISTICS_FIXED_FEE_BUJUMBURA si
    acheteur et fermier sont dans la même province, sinon
    LOGISTICS_FIXED_FEE_PROVINCE) car les coordonnées GPS sont facultatives
    à l'inscription et souvent absentes — calculate_distance_km renvoie
    silencieusement 0.0 dans ce cas, ce qui donnerait un forfait à 0 BIF si
    on ne s'en protégeait pas explicitement. Quand les deux ont de vraies
    coordonnées, le tarif kilométrique (LOGISTICS_PRICE_PER_KM) prend le
    relai s'il dépasse le forfait de base.
    """
    same_province = bool(
        buyer and farmer and buyer.province and farmer.province
        and normalize_market_province(cast(str, buyer.province)) == normalize_market_province(cast(str, farmer.province))
    )
    base_fee = config.LOGISTICS_FIXED_FEE_BUJUMBURA if same_province else config.LOGISTICS_FIXED_FEE_PROVINCE

    distance_km = calculate_distance_km(buyer, farmer)
    if distance_km > 0:
        distance_fee = Decimal(str(round(distance_km, 2))) * config.LOGISTICS_PRICE_PER_KM
        return max(base_fee, distance_fee)
    return base_fee

def format_distance_label(km: float) -> str:
    if km < 1: return f"{int(km * 1000)}m"
    return f"{km:.1f}km"

def format_duration_label(km: float) -> str:
    avg_speed_kmh = 30 # Vitesse moyenne (route Burundi)
    if km == 0: return "0 min"
    minutes = int((km / avg_speed_kmh) * 60)
    if minutes < 60: return f"{minutes} min"
    return f"{minutes // 60}h {minutes % 60}m"

def serialize_user_coordinates(user: Optional[models.User]) -> Optional[dict]:
    if not user or user.latitude is None: return None
    return {"lat": user.latitude, "lng": user.longitude}

def normalize_market_province(province: Optional[str]) -> Optional[str]:
    if not province: return None
    return province.strip().lower()

def format_market_scope_label(province: Optional[str]) -> str:
    if not province: return "National"
    return province.strip().capitalize()
