def calculate_travel_premium(
    coverage_eth: float,
    duration_days: int,
    destination: str,
    airline: str = None
) -> dict:
    """
    Travel insurance premium based on:
    - Coverage amount
    - Trip duration
    - Destination risk level
    - Airline safety rating
    """
    # Base rate: 2% of coverage
    base_rate = 0.02
    
    # Destination risk multipliers
    high_risk = ["pakistan", "afghanistan", "iraq", "syria", "yemen"]
    medium_risk = ["egypt", "nigeria", "kenya", "bangladesh", "nepal"]
    
    dest_lower = destination.lower()
    if any(country in dest_lower for country in high_risk):
        destination_multiplier = 2.5
        risk_level = "High"
    elif any(country in dest_lower for country in medium_risk):
        destination_multiplier = 1.5
        risk_level = "Medium"
    else:
        destination_multiplier = 1.0
        risk_level = "Low"
    
    # Duration multiplier (longer trips = more risk)
    if duration_days <= 7:
        duration_multiplier = 1.0
    elif duration_days <= 30:
        duration_multiplier = 1.3
    elif duration_days <= 90:
        duration_multiplier = 1.6
    else:
        duration_multiplier = 2.0
    
    # Calculate premium
    premium = coverage_eth * base_rate * destination_multiplier * duration_multiplier
    
    # Minimum premium: 0.01 ETH
    premium = max(0.01, round(premium, 4))
    
    return {
        "premium_eth": premium,
        "coverage_eth": coverage_eth,
        "duration_days": duration_days,
        "destination": destination,
        "risk_level": risk_level,
        "destination_multiplier": destination_multiplier,
        "duration_multiplier": duration_multiplier,
        "base_rate_percent": base_rate * 100,
        "breakdown": {
            "base_premium": round(coverage_eth * base_rate, 4),
            "destination_adjustment": round(
                coverage_eth * base_rate * (destination_multiplier - 1), 4
            ),
            "duration_adjustment": round(
                coverage_eth * base_rate * destination_multiplier * 
                (duration_multiplier - 1), 4
            )
        }
    }

def calculate_crop_premium(
    coverage_eth: float,
    duration_days: int,
    location: str,
    crop_type: str,
    season: str
) -> dict:
    """
    Crop insurance premium based on:
    - Coverage amount
    - Location (drought-prone areas cost more)
    - Crop type (some crops are riskier)
    - Season (monsoon vs dry season)
    """
    base_rate = 0.03
    
    # Location risk (drought-prone regions)
    drought_prone = ["rajasthan", "gujarat", "maharashtra", 
                     "karnataka", "andhra"]
    flood_prone = ["assam", "bihar", "west bengal", "kerala", "odisha"]
    
    loc_lower = location.lower()
    if any(region in loc_lower for region in drought_prone):
        location_multiplier = 1.8
        location_risk = "Drought-Prone"
    elif any(region in loc_lower for region in flood_prone):
        location_multiplier = 1.6
        location_risk = "Flood-Prone"
    else:
        location_multiplier = 1.0
        location_risk = "Normal"
    
    # Crop type risk
    crop_risk = {
        "wheat": 1.0,
        "rice": 1.2,
        "cotton": 1.4,
        "sugarcane": 1.3,
        "vegetables": 1.6,
        "fruits": 1.5,
        "pulses": 1.1
    }
    crop_multiplier = crop_risk.get(crop_type.lower(), 1.2)
    
    # Season risk
    season_risk = {
        "kharif": 1.3,    # Monsoon season, unpredictable
        "rabi": 1.0,      # Winter season, more stable
        "zaid": 1.4,      # Summer season, drought risk
        "monsoon": 1.3,
        "winter": 1.0,
        "summer": 1.4
    }
    season_multiplier = season_risk.get(season.lower(), 1.2)
    
    premium = (coverage_eth * base_rate * 
               location_multiplier * crop_multiplier * season_multiplier)
    premium = max(0.01, round(premium, 4))
    
    return {
        "premium_eth": premium,
        "coverage_eth": coverage_eth,
        "location": location,
        "crop_type": crop_type,
        "season": season,
        "location_risk": location_risk,
        "breakdown": {
            "base_premium": round(coverage_eth * base_rate, 4),
            "location_adjustment": round(
                coverage_eth * base_rate * (location_multiplier - 1), 4
            ),
            "crop_adjustment": round(
                coverage_eth * base_rate * location_multiplier * 
                (crop_multiplier - 1), 4
            ),
            "season_adjustment": round(
                coverage_eth * base_rate * location_multiplier * 
                crop_multiplier * (season_multiplier - 1), 4
            )
        }
    }

def calculate_health_premium(
    coverage_eth: float,
    duration_days: int,
    age: int,
    has_pre_existing: bool,
    smoker: bool = False
) -> dict:
    """
    Health insurance premium based on:
    - Age (older = higher risk)
    - Pre-existing conditions
    - Smoker status
    - Coverage amount and duration
    """
    base_rate = 0.025
    
    # Age multiplier
    if age < 25:
        age_multiplier = 0.8
        age_risk = "Low"
    elif age < 35:
        age_multiplier = 1.0
        age_risk = "Low"
    elif age < 45:
        age_multiplier = 1.3
        age_risk = "Medium"
    elif age < 55:
        age_multiplier = 1.7
        age_risk = "Medium-High"
    elif age < 65:
        age_multiplier = 2.2
        age_risk = "High"
    else:
        age_multiplier = 3.0
        age_risk = "Very High"
    
    # Pre-existing conditions
    pre_existing_multiplier = 1.8 if has_pre_existing else 1.0
    
    # Smoker surcharge
    smoker_multiplier = 1.4 if smoker else 1.0
    
    # Duration multiplier
    duration_multiplier = max(1.0, duration_days / 365)
    
    premium = (coverage_eth * base_rate * age_multiplier * 
               pre_existing_multiplier * smoker_multiplier * 
               duration_multiplier)
    premium = max(0.01, round(premium, 4))
    
    return {
        "premium_eth": premium,
        "coverage_eth": coverage_eth,
        "age": age,
        "age_risk": age_risk,
        "has_pre_existing": has_pre_existing,
        "smoker": smoker,
        "breakdown": {
            "base_premium": round(coverage_eth * base_rate, 4),
            "age_adjustment": round(
                coverage_eth * base_rate * (age_multiplier - 1), 4
            ),
            "pre_existing_adjustment": round(
                coverage_eth * base_rate * age_multiplier * 
                (pre_existing_multiplier - 1), 4
            ),
            "smoker_adjustment": round(
                coverage_eth * base_rate * age_multiplier * 
                pre_existing_multiplier * (smoker_multiplier - 1), 4
            )
        }
    }
