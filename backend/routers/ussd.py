from fastapi import APIRouter, Depends, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

import backend.models as models
import backend.config as config
from backend.database import get_db
from backend.services.market_service import market_service

router = APIRouter(prefix="/ussd", tags=["USSD"])


@router.post("", response_class=PlainTextResponse)
@router.post("/", response_class=PlainTextResponse)
def handle_ussd(
    sessionId: str = Form(...),
    serviceCode: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    Point d'entrée USSD (format Africa's Talking, standard de facto pour les
    agrégateurs télécom en Afrique). Contrairement à un login web, il n'y a
    pas de session persistée côté serveur : à chaque frappe, l'opérateur
    renvoie TOUT le texte accumulé depuis le début ("1*Tomates" = a choisi
    le menu 1 puis tapé "Tomates") — on reconstruit l'état à chaque appel en
    re-parsant `text`.

    Réponse en texte brut : "CON <texte>" continue la session (affiche un
    nouveau menu), "END <texte>" la termine (message final affiché puis
    l'écran se ferme). phoneNumber vient de l'opérateur lui-même (pas saisi
    par l'utilisateur) : c'est un signal d'identité aussi fiable qu'un SMS
    OTP, pas besoin de PIN supplémentaire pour de la simple consultation.
    """
    steps = text.split("*") if text else []
    # Certains agrégateurs envoient le numéro sans le préfixe "+" (ex.
    # "25779000001" au lieu de "+25779000001") — on tente les deux formats
    # plutôt que de silencieusement traiter un fermier enregistré comme
    # "numéro inconnu".
    user = db.query(models.User).filter(models.User.phone_number == phoneNumber).first()
    if not user and not phoneNumber.startswith("+"):
        user = db.query(models.User).filter(models.User.phone_number == f"+{phoneNumber}").first()

    # Menu principal
    if not steps or steps == [""]:
        return (
            "CON Bienvenue sur AgriConnect\n"
            "1. Prix du marche\n"
            "2. Mon solde\n"
            "3. Mes commandes en attente\n"
            "4. Aide"
        )

    choice = steps[0]

    # 1. Prix du marché — réutilise MarketService.get_price_for_sms, qui
    # interroge déjà les vrais prix (mêmes données que Soko Live).
    if choice == "1":
        if len(steps) == 1:
            return "CON Entrez le nom du produit (ex: Tomates):"
        product_query = steps[1]
        result = market_service.get_price_for_sms(db, product_query)
        return f"END {result}"

    # 2. Mon solde
    if choice == "2":
        if not user:
            return "END Ce numero n'est pas enregistre sur AgriConnect."
        return f"END Votre solde AgriConnect est de {user.balance} BIF."

    # 3. Mes commandes en attente de collecte (côté fermier)
    if choice == "3":
        if not user:
            return "END Ce numero n'est pas enregistre sur AgriConnect."
        pending = db.query(models.Order).filter(
            models.Order.farmer_id == user.id,
            models.Order.status.in_(["PAID_ESCROW", "CONFIRMED", "READY_FOR_PICKUP"]),
        ).count()
        if pending == 0:
            return "END Aucune commande en attente de collecte."
        return f"END Vous avez {pending} commande(s) en attente de collecte par le livreur."

    # 4. Aide — reprend le numero support configurable par l'admin
    # (SystemSettings), pas une valeur figee.
    if choice == "4":
        settings = db.query(models.SystemSettings).first()
        support_phone = (settings.support_phone if settings else None) or config.DEFAULT_SUPPORT_PHONE
        return f"END Besoin d'aide ? Appelez le {support_phone}. AgriConnect vous connecte au marche."

    return "END Choix invalide. Recomposez et choisissez une option du menu."
