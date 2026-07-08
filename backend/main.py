from dotenv import load_dotenv
from pathlib import Path
import os

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini import decode_policy
import json
from web3 import Web3
from oracles import check_weather_trigger, check_flight_delay
from pricing import (
    calculate_travel_premium,
    calculate_crop_premium, 
    calculate_health_premium
)
from groq import Groq

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PolicyRequest(BaseModel):
    text: str

class OracleSettleRequest(BaseModel):
    policy_token_id: int

class WeatherOracleRequest(BaseModel):
    policy_token_id: int
    city: str
    threshold_mm: float
    operator: str = "less_than"

class FlightOracleRequest(BaseModel):
    policy_token_id: int
    flight_number: str
    threshold_minutes: int = 180

class TravelPriceRequest(BaseModel):
    coverage_eth: float
    duration_days: int
    destination: str
    airline: str = ""

class CropPriceRequest(BaseModel):
    coverage_eth: float
    duration_days: int
    location: str
    crop_type: str
    season: str

class HealthPriceRequest(BaseModel):
    coverage_eth: float
    duration_days: int
    age: int
    has_pre_existing: bool = False
    smoker: bool = False

class CompareRequest(BaseModel):
    policy_a: str
    policy_b: str
    label_a: str = "Policy A"
    label_b: str = "Policy B"

HARDHAT_RPC = "http://127.0.0.1:8545"
DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

def get_policy_nft_abi():
    # Try multiple possible paths
    possible_paths = [
        Path(__file__).parent.parent / "artifacts/contracts/PolicyNFT.sol/PolicyNFT.json",
        Path(__file__).parent / "../artifacts/contracts/PolicyNFT.sol/PolicyNFT.json",
    ]
    
    for path in possible_paths:
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                print(f"DEBUG: Loaded ABI from {path}")
                print(f"DEBUG: ABI functions: {[x['name'] for x in data['abi'] if x['type'] == 'function']}")
                return data["abi"]
    
    raise FileNotFoundError("PolicyNFT.json ABI not found")

@app.get("/health")
def health():
    return {"status": "ok", "groq_key_set": bool(os.getenv("GROQ_API_KEY"))}

@app.post("/decode")
async def decode(request: PolicyRequest):
    if not request.text or len(request.text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Policy text too short")
    try:
        result = decode_policy(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/oracle/settle")
async def oracle_settle(request: OracleSettleRequest):
    try:
        w3 = Web3(Web3.HTTPProvider(HARDHAT_RPC))
        abi = get_policy_nft_abi()
        policy_nft_address = os.getenv("POLICY_NFT_ADDRESS")
        if not policy_nft_address:
            raise Exception("POLICY_NFT_ADDRESS env variable is not set")
            
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(policy_nft_address),
            abi=abi
        )
        account = w3.eth.account.from_key(DEPLOYER_PRIVATE_KEY)
        
        # Check if trustedOracle is the deployer, if not set it to deployer so autoApproveClaim can succeed
        trusted_oracle = contract.functions.trustedOracle().call()
        if Web3.to_checksum_address(trusted_oracle) != Web3.to_checksum_address(account.address):
            # Set oracle to deployer
            set_oracle_tx = contract.functions.setOracle(account.address).build_transaction({
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 200000,
                "gasPrice": w3.eth.gas_price
            })
            signed_set_oracle = w3.eth.account.sign_transaction(set_oracle_tx, DEPLOYER_PRIVATE_KEY)
            set_oracle_hash = w3.eth.send_raw_transaction(signed_set_oracle.raw_transaction)
            w3.eth.wait_for_transaction_receipt(set_oracle_hash)
            
        # Build transaction
        tx = contract.functions.autoApproveClaim(
            request.policy_token_id
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200000,
            "gasPrice": w3.eth.gas_price
        })
        
        # Sign and send
        signed = w3.eth.account.sign_transaction(tx, DEPLOYER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return {
            "success": True,
            "tx_hash": tx_hash.hex(),
            "block": receipt["blockNumber"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/oracle/weather")
async def weather_oracle(request: WeatherOracleRequest):
    """
    Check real weather data and auto-approve claim if condition met.
    """
    try:
        result = await check_weather_trigger(
            request.city,
            request.threshold_mm,
            request.operator
        )
        
        if result["condition_met"]:
            settle_result = await oracle_settle(
                OracleSettleRequest(policy_token_id=request.policy_token_id)
            )
            result["blockchain_tx"] = settle_result
            result["claim_status"] = "PAID"
        else:
            result["claim_status"] = "REJECTED"
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/oracle/flight")
async def flight_oracle(request: FlightOracleRequest):
    """
    Check real flight delay data and auto-approve claim if delayed.
    """
    try:
        result = await check_flight_delay(
            request.flight_number,
            request.threshold_minutes
        )
        
        if result["condition_met"]:
            settle_result = await oracle_settle(
                OracleSettleRequest(policy_token_id=request.policy_token_id)
            )
            result["blockchain_tx"] = settle_result
            result["claim_status"] = "PAID"
        else:
            result["claim_status"] = "REJECTED"
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/oracle/weather/check")
async def check_weather(city: str, threshold_mm: float = 30):
    """Quick weather check without triggering claim"""
    try:
        return await check_weather_trigger(city, threshold_mm, "less_than")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/oracle/flight/check")
async def check_flight(flight_number: str, threshold_minutes: int = 180):
    """Quick flight check without triggering claim"""
    try:
        return await check_flight_delay(flight_number, threshold_minutes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pricing/travel")
def price_travel(request: TravelPriceRequest):
    return calculate_travel_premium(
        request.coverage_eth,
        request.duration_days,
        request.destination,
        request.airline
    )

@app.post("/pricing/crop")
def price_crop(request: CropPriceRequest):
    return calculate_crop_premium(
        request.coverage_eth,
        request.duration_days,
        request.location,
        request.crop_type,
        request.season
    )

@app.post("/pricing/health")
def price_health(request: HealthPriceRequest):
    return calculate_health_premium(
        request.coverage_eth,
        request.duration_days,
        request.age,
        request.has_pre_existing,
        request.smoker
    )

@app.get("/pool/stats")
async def pool_stats():
    from fastapi.responses import JSONResponse
    try:
        w3 = Web3(Web3.HTTPProvider(HARDHAT_RPC))
        abi = get_policy_nft_abi()
        policy_nft_address = os.getenv("POLICY_NFT_ADDRESS")
        if not policy_nft_address:
            raise Exception("POLICY_NFT_ADDRESS env variable is not set")
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(policy_nft_address),
            abi=abi
        )
        stats = contract.functions.getPoolStats().call()
        
        balance = float(Web3.from_wei(stats[0], "ether"))
        premiums = float(Web3.from_wei(stats[1], "ether"))
        claims_paid = float(Web3.from_wei(stats[2], "ether"))
        active_policies = stats[3]
        coverage_exposure = float(Web3.from_wei(stats[4], "ether"))
        is_open = stats[5]
        pool_ratio = stats[6]
        
        if pool_ratio >= 50:
            health = "Healthy"
            health_color = "green"
        elif pool_ratio >= 20:
            health = "Moderate"
            health_color = "amber"
        else:
            health = "Critical"
            health_color = "red"
        
        result = {
            "pool_balance_eth": round(balance, 4),
            "total_premiums_collected": round(premiums, 4),
            "total_claims_paid": round(claims_paid, 4),
            "active_policies": active_policies,
            "coverage_exposure_eth": round(coverage_exposure, 4),
            "pool_open": is_open,
            "pool_ratio_percent": pool_ratio,
            "pool_health": health,
            "health_color": health_color,
            "solvency_message": (
                "Pool is well-capitalized" if pool_ratio >= 50
                else "Pool is adequately funded" if pool_ratio >= 20
                else "Pool is undercollateralized - new policies paused"
            )
        }
        response = JSONResponse(content=result)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/compare")
async def compare_policies(request: CompareRequest):
    prompt = f"""
You are an expert insurance policy analyst. 
Compare these two insurance policies and return 
a JSON object with exactly this structure:

{{
  "winner": "A" or "B" or "TIE",
  "winner_reason": "one sentence why this policy is better overall",
  "summary": {{
    "policy_a": "2-3 sentence summary of Policy A",
    "policy_b": "2-3 sentence summary of Policy B"
  }},
  "grades": {{
    "policy_a": "A" or "B" or "C" or "D" or "F",
    "policy_b": "A" or "B" or "C" or "D" or "F"
  }},
  "comparison": [
    {{
      "category": "category name (e.g. Coverage Limit, Claim Window, Exclusions)",
      "policy_a": "what policy A says about this",
      "policy_b": "what policy B says about this",
      "winner": "A" or "B" or "TIE",
      "importance": "High" or "Medium" or "Low"
    }}
  ],
  "policy_a_pros": ["list", "of", "advantages"],
  "policy_a_cons": ["list", "of", "disadvantages"],
  "policy_b_pros": ["list", "of", "advantages"],
  "policy_b_cons": ["list", "of", "disadvantages"],
  "recommendation": "2-3 sentence plain English recommendation of which policy to choose and why",
  "gotchas": {{
    "policy_a": ["unique trap clauses in A"],
    "policy_b": ["unique trap clauses in B"]
  }}
}}

Compare across these categories:
- Coverage Limit
- Premium Value
- Claim Filing Window
- Exclusions
- Payout Conditions
- Renewal Terms
- Overall Fairness

Return ONLY the JSON. No markdown, no backticks.

POLICY A ({request.label_a}):
{request.policy_a}

POLICY B ({request.label_b}):
{request.policy_b}
"""
    import json
    import groq
    groq_key = os.getenv("GROQ_API_KEY")
    print(f"DEBUG compare: GROQ key = {groq_key[:10] if groq_key else 'NOT FOUND'}")
    client = Groq(api_key=groq_key)
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except groq.AuthenticationError:
        raise HTTPException(
            status_code=400,
            detail="Invalid Groq API key. Please check your GROQ_API_KEY in backend/.env"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
