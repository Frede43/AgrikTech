from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any
from backend.services.weather_service import weather_service

router = APIRouter(
    prefix="/weather",
    tags=["weather"]
)

@router.get("/forecast")
def get_weather(province: str = Query("Bujumbura")):
    """
    Récupère la météo et les conseils pour une province donnée.
    """
    weather_data = weather_service.get_weather_forecast(province)
    tips = weather_service.get_agricultural_tips(province, weather_data["current"]["description"])
    
    return {
        "weather": weather_data,
        "tips": tips
    }

@router.get("/provinces")
def get_provinces():
    """
    Liste des provinces supportées.
    """
    return list(weather_service.PROVINCE_COORDS.keys())
