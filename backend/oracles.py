import httpx
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

OPENWEATHER_KEY = os.getenv("OPENWEATHER_API_KEY")
AVIATIONSTACK_KEY = os.getenv("AVIATIONSTACK_API_KEY")

# ── Weather Oracle ────────────────────────────────────────

async def get_rainfall(city: str) -> dict:
    if not OPENWEATHER_KEY:
        raise ValueError("OPENWEATHER_API_KEY not set in backend/.env")
    
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": OPENWEATHER_KEY,
        "units": "metric"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        
        if response.status_code == 401:
            raise ValueError("Invalid OpenWeatherMap API key")
        if response.status_code == 404:
            raise ValueError(f"City '{city}' not found")
            
        data = response.json()
    
    rainfall = data.get("rain", {}).get("1h", 0) * 24
    return {
        "city": city,
        "rainfall_mm": rainfall,
        "temperature": data["main"]["temp"],
        "humidity": data["main"]["humidity"],
        "description": data["weather"][0]["description"],
        "timestamp": data["dt"]
    }

async def check_weather_trigger(
    city: str, 
    threshold_mm: float, 
    operator: str  # "less_than" or "greater_than"
) -> dict:
    """
    Check if rainfall condition is met.
    Returns whether claim should be approved.
    """
    weather = await get_rainfall(city)
    rainfall = weather["rainfall_mm"]
    
    if operator == "less_than":
        condition_met = rainfall < threshold_mm
    else:
        condition_met = rainfall > threshold_mm
    
    return {
        "condition_met": condition_met,
        "actual_value": rainfall,
        "threshold": threshold_mm,
        "operator": operator,
        "city": city,
        "weather_data": weather,
        "verdict": "APPROVE" if condition_met else "REJECT",
        "reason": f"Rainfall {rainfall}mm is {'below' if operator == 'less_than' else 'above'} threshold {threshold_mm}mm"
    }

# ── Flight Oracle ─────────────────────────────────────────

async def check_flight_delay(
    flight_number: str,
    threshold_minutes: int = 180
) -> dict:
    """
    Check if a flight is delayed beyond threshold.
    Default threshold: 3 hours (180 minutes)
    """
    url = "http://api.aviationstack.com/v1/flights"
    params = {
        "access_key": AVIATIONSTACK_KEY,
        "flight_iata": flight_number
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        data = response.json()
    
    if not data.get("data"):
        return {
            "condition_met": False,
            "verdict": "REJECT",
            "reason": f"Flight {flight_number} not found"
        }
    
    flight = data["data"][0]
    status = flight.get("flight_status", "")
    
    # Calculate delay in minutes
    scheduled = flight.get("departure", {}).get("scheduled")
    actual = flight.get("departure", {}).get("actual") or \
             flight.get("departure", {}).get("estimated")
    
    delay_minutes = 0
    if scheduled and actual:
        from datetime import datetime
        fmt = "%Y-%m-%dT%H:%M:%S+00:00"
        try:
            sched_dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
            actual_dt = datetime.fromisoformat(actual.replace("Z", "+00:00"))
            delay_minutes = max(0, (actual_dt - sched_dt).seconds // 60)
        except:
            delay_minutes = flight.get("departure", {}).get("delay", 0) or 0
    
    condition_met = delay_minutes >= threshold_minutes
    
    return {
        "condition_met": condition_met,
        "flight_number": flight_number,
        "status": status,
        "delay_minutes": delay_minutes,
        "threshold_minutes": threshold_minutes,
        "verdict": "APPROVE" if condition_met else "REJECT",
        "reason": f"Flight delayed {delay_minutes} mins, threshold is {threshold_minutes} mins",
        "flight_data": {
            "airline": flight.get("airline", {}).get("name"),
            "departure_airport": flight.get("departure", {}).get("airport"),
            "arrival_airport": flight.get("arrival", {}).get("airport"),
            "scheduled": scheduled,
            "actual": actual
        }
    }
