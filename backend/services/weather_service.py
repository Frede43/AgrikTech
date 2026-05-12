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

    @staticmethod
    def get_weather_forecast(province: str) -> Dict[str, Any]:
        """
        Récupère les prévisions météo via OpenWeatherMap.
        """
        coords = WeatherService.PROVINCE_COORDS.get(province, WeatherService.PROVINCE_COORDS["Bujumbura"])
        api_key = "598d140fc1b16788d12b9f975c78a2b2"
        
        try:
            # On utilise l'API forecast 5 jours / 3 heures
            url = f"https://api.openweathermap.org/data/2.5/forecast?lat={coords['lat']}&lon={coords['lon']}&appid={api_key}&units=metric&lang=fr"
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            # Extraction du temps actuel (premier élément de la liste)
            current_data = data["list"][0]
            
            # Extraction des prévisions quotidiennes (on prend un point par jour à midi environ)
            daily_forecast = []
            seen_days = set()
            
            for item in data["list"]:
                dt = datetime.fromtimestamp(item["dt"])
                day_name = dt.strftime("%a") # Ex: Lun, Mar...
                
                # On évite le jour actuel et on prend une mesure par jour
                if day_name not in seen_days and len(daily_forecast) < 5:
                    daily_forecast.append({
                        "date": day_name,
                        "temp": round(item["main"]["temp"]),
                        "icon": item["weather"][0]["icon"],
                        "desc": item["weather"][0]["description"].capitalize()
                    })
                    seen_days.add(day_name)

            return {
                "city": province,
                "current": {
                    "temp": round(current_data["main"]["temp"]),
                    "humidity": current_data["main"]["humidity"],
                    "wind_speed": round(current_data["wind"]["speed"] * 3.6), # m/s to km/h
                    "description": current_data["weather"][0]["description"].capitalize(),
                    "icon": current_data["weather"][0]["icon"]
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
