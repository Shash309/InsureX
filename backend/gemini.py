import os
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path
import json

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def decode_policy(policy_text: str) -> dict:
    prompt = f"""
You are an expert insurance policy analyst. Analyze the following 
insurance policy text and return a JSON object with exactly these fields:

{{
  "grade": "A" or "B" or "C" or "D" or "F",
  "grade_reason": "one sentence explanation of the grade",
  "summary": "2-3 sentence plain English summary of what this policy does",
  "coverage": ["list", "of", "things", "covered"],
  "exclusions": ["list", "of", "things", "NOT covered"],
  "gotchas": ["list", "of", "trap clauses", "hidden conditions", 
              "tight deadlines", "conditions that void the claim"]
}}

Grading scale:
A = Excellent coverage, fair terms, no major gotchas
B = Good coverage, minor restrictions  
C = Average, several notable exclusions
D = Poor coverage, many gotchas
F = Extremely restrictive, policyholder heavily disadvantaged

Return ONLY the JSON object. No markdown, no backticks, no explanation.

POLICY TEXT:
{policy_text}
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1000
    )
    
    text = response.choices[0].message.content.strip()
    
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    return json.loads(text.strip())
