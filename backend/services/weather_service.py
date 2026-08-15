import requests
from typing import List, Dict, Any
from datetime import datetime
import backend.config as config

class WeatherService:
    """
    Service pour la météo et les conseils agricoles adaptés au Burundi.
    """
    
    # Coordonnées approximatives des provinces du Burundi pour la météo
    PROVINCE_COORDS = {
        "Bujumbura": {"lat": -3.38, "lon": 29.36},
        "Gitega": {"lat": -3.43, "lon": 29.93},
        "Ngozi": {"lat": -2.90, "lon": 29.83},
        "Kayanza": {"lat": -2.92, "lon": 29.63},
        "Kirundo": {"lat": -2.58, "lon": 30.10},
        "Muyinga": {"lat": -2.85, "lon": 30.34},
        "Cankuzo": {"lat": -3.22, "lon": 30.45},
        "Ruyigi": {"lat": -3.48, "lon": 30.25},
        "Rutana": {"lat": -3.93, "lon": 30.00},
        "Makamba": {"lat": -4.13, "lon": 29.80},
        "Bururi": {"lat": -3.95, "lon": 29.62},
        "Rumonge": {"lat": -3.97, "lon": 29.43},
        "Cibitoke": {"lat": -2.89, "lon": 29.12},
        "Bubanza": {"lat": -3.08, "lon": 29.39},
        "Muramvya": {"lat": -3.27, "lon": 29.61},
        "Mwaro": {"lat": -3.51, "lon": 29.70},
        "Karuzi": {"lat": -3.10, "lon": 30.15},
    }

    # Codes météo WMO (Open-Meteo) → (description FR, icône style OpenWeatherMap,
    # attendue par le frontend pour construire l'URL de l'image).
    WMO_CODES = {
        0: ("Ensoleillé", "01d"),
        1: ("Plutôt ensoleillé", "02d"),
        2: ("Partiellement nuageux", "03d"),
        3: ("Couvert et nuageux", "04d"),
        45: ("Brouillard", "50d"),
        48: ("Brouillard givrant", "50d"),
        51: ("Bruine légère", "09d"),
        53: ("Bruine", "09d"),
        55: ("Bruine dense", "09d"),
        56: ("Bruine verglaçante", "09d"),
        57: ("Bruine verglaçante dense", "09d"),
        61: ("Pluie légère", "10d"),
        63: ("Pluie", "10d"),
        65: ("Pluie forte", "10d"),
        66: ("Pluie verglaçante", "10d"),
        67: ("Pluie verglaçante forte", "10d"),
        71: ("Neige légère", "13d"),
        73: ("Neige", "13d"),
        75: ("Neige forte", "13d"),
        77: ("Grésil", "13d"),
        80: ("Averses légères", "09d"),
        81: ("Averses", "09d"),
        82: ("Averses violentes", "09d"),
        95: ("Orage", "11d"),
        96: ("Orage avec grêle", "11d"),
        99: ("Orage avec grêle forte", "11d"),
    }

    JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

    @staticmethod
    def get_weather_forecast(province: str) -> Dict[str, Any]:
        """
        Récupère les prévisions météo via Open-Meteo (gratuit, sans clé API).
        """
        coords = WeatherService.PROVINCE_COORDS.get(province, WeatherService.PROVINCE_COORDS["Bujumbura"])

        try:
            url = (
                "https://api.open-meteo.com/v1/forecast"
                f"?latitude={coords['lat']}&longitude={coords['lon']}"
                "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
                "&daily=temperature_2m_max,weather_code"
                "&timezone=Africa/Bujumbura&forecast_days=6&wind_speed_unit=kmh"
            )
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()

            current = data["current"]
            cur_desc, cur_icon = WeatherService.WMO_CODES.get(
                int(current.get("weather_code", 0)), ("Conditions inconnues", "01d")
            )

            daily = data.get("daily", {})
            daily_forecast = []
            dates = daily.get("time", [])
            temps = daily.get("temperature_2m_max", [])
            codes = daily.get("weather_code", [])
            # On saute le jour courant (index 0) et on garde 5 jours.
            for i in range(1, min(len(dates), 6)):
                day = datetime.strptime(dates[i], "%Y-%m-%d")
                desc, icon = WeatherService.WMO_CODES.get(int(codes[i]), ("Conditions inconnues", "01d"))
                daily_forecast.append({
                    "date": WeatherService.JOURS_FR[day.weekday()],
                    "temp": round(temps[i]),
                    "icon": icon,
                    "desc": desc,
                })

            return {
                "city": province,
                "current": {
                    "temp": round(current["temperature_2m"]),
                    "humidity": current["relative_humidity_2m"],
                    "wind_speed": round(current["wind_speed_10m"]),
                    "description": cur_desc,
                    "icon": cur_icon,
                },
                "forecast": daily_forecast
            }

        except Exception as e:
            print(f"Erreur API Météo: {e}")
            # Fallback sur un mock basique en cas d'erreur
            return {
                "city": f"{province} (Mode dégradé)",
                "current": {"temp": 24, "humidity": 60, "wind_speed": 10, "description": "Données indisponibles", "icon": "01d"},
                "forecast": []
            }

    @staticmethod
    def get_agricultural_tips(province: str, weather_desc: str) -> List[Dict[str, Any]]:
        """
        Génère des conseils basés sur la météo et la région.
        """
        tips = []
        
        # Conseils basés sur la description météo
        if "pluie" in weather_desc.lower() or "averses" in weather_desc.lower():
            tips.append({
                "title": "Gestion de l'humidité",
                "body": "Risque élevé de mildiou. Évitez de récolter pendant la pluie pour prévenir la pourriture.",
                "type": "warning"
            })
            tips.append({
                "title": "Drainage",
                "body": "Vérifiez vos canaux d'évacuation pour éviter l'érosion des sols sur les collines.",
                "type": "info"
            })
        elif "soleil" in weather_desc.lower() or "nuageux" in weather_desc.lower():
            tips.append({
                "title": "Irrigation optimale",
                "body": "C'est le moment idéal pour arroser tôt le matin ou tard le soir afin de limiter l'évaporation.",
                "type": "success"
            })
            tips.append({
                "title": "Traitement",
                "body": "Bonne fenêtre pour l'application d'engrais organiques, le temps sec favorise l'absorption.",
                "type": "info"
            })

        # Conseils régionaux
        if province in ["Ngozi", "Kayanza"]:
            tips.append({
                "title": "Spécial Café",
                "body": "Période de floraison dans votre région. Surveillez les insectes ravageurs.",
                "type": "tip"
            })
        elif province == "Kirundo":
            tips.append({
                "title": "Alerte Sécheresse",
                "body": "Le niveau des lacs baisse. Priorisez le paillage pour conserver l'humidité des sols.",
                "type": "warning"
            })

        # Conseil général par défaut si vide
        if not tips:
            tips.append({
                "title": "Maintenance préventive",
                "body": "Nettoyez vos outils de récolte pour garantir la qualité sanitaire de vos produits.",
                "type": "info"
            })

        return tips

weather_service = WeatherService()
