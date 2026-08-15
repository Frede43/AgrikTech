import httpx
import logging
from typing import Optional, List, Tuple
import backend.config as config

logger = logging.getLogger(__name__)

class LocationService:
    """
    Service pour interagir avec OpenRouteService (ORS).
    Permet d'obtenir des distances réelles par la route au lieu du vol d'oiseau.
    """
    
    BASE_URL = "https://api.openrouteservice.org"
    
    @staticmethod
    async def get_road_distance_km(start_coords: Tuple[float, float], end_coords: Tuple[float, float]) -> Optional[float]:
        """
        Calcule la distance réelle par la route entre deux points.
        Format coords: (latitude, longitude)
        """
        if not config.ORS_API_KEY:
            logger.warning("ORS_API_KEY non configurée. Impossible de calculer la distance réelle.")
            return None
            
        # ORS attend [longitude, latitude]
        start = [start_coords[1], start_coords[0]]
        end = [end_coords[1], end_coords[0]]
        
        url = f"{LocationService.BASE_URL}/v2/directions/driving-car/json"
        headers = {
            "Authorization": config.ORS_API_KEY,
            "Content-Type": "application/json"
        }
        body = {
            "coordinates": [start, end],
            "units": "m"
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=body, headers=headers)
                
                if response.status_code != 200:
                    logger.error(f"Erreur ORS ({response.status_code}): {response.text}")
                    return None
                    
                data = response.json()
                # Extraire la distance en mètres depuis la première route
                distance_m = data["routes"][0]["summary"]["distance"]
                return distance_m / 1000.0 # Convertir en km
                
        except Exception as e:
            logger.error(f"Exception lors de l'appel à ORS: {str(e)}")
            return None

location_service = LocationService()
