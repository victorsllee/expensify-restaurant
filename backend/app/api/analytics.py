from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from google import genai
import json
import os

from app.api.auth import verify_token
from app.database import get_db

router = APIRouter()

# Initialize Gemini Client globally
gemini_api_key = os.environ.get("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

class QueryRequest(BaseModel):
    query: str

# Schema definition to help Gemini understand our database structure
SCHEMA_CONTEXT = """
You are a PostgreSQL expert assisting a restaurant owner.
Translate their natural language query into a valid SQL query based on the following database schema:

Table: vendors
- id (Integer, Primary Key)
- user_id (String)
- name (String)
- default_category (String)

Table: receipts
- id (Integer, Primary Key)
- user_id (String)
- vendor_id (Integer, Foreign Key to vendors.id)
- total_amount (Float)
- tax_amount (Float)
- date (DateTime)
- status (String, either 'PROCESSING', 'PENDING' or 'APPROVED')

Table: line_items
- id (Integer, Primary Key)
- receipt_id (Integer, Foreign Key to receipts.id)
- description (String)
- amount (Float)

Return ONLY a JSON object containing the SQL query. Do not use markdown blocks. Use double quotes for keys.
Example output format:
{
    "sql": "SELECT v.name, SUM(r.total_amount) as total FROM receipts r JOIN vendors v ON r.vendor_id = v.id WHERE r.user_id = '{uid}' AND r.date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY v.name ORDER BY total DESC LIMIT 5"
}

IMPORTANT RULES:
- You MUST ensure the query is scoped to the specific user by ALWAYS including `user_id = '{uid}'` in your WHERE clauses for `receipts` and/or `vendors`. (The python code will replace {uid} with the actual ID).
- Use PostgreSQL syntax for date math (e.g. `CURRENT_DATE - INTERVAL '1 month'` or `date_trunc('month', date)`).
"""

@router.post("/query")
def process_natural_language_query(
    request: QueryRequest, 
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="Gemini API key is missing or invalid.")
    try:
        # 1. Ask Gemini to generate the SQL
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"{SCHEMA_CONTEXT}\n\nUser Query: {request.query}",
        )
        
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        try:
            sql_data = json.loads(raw_text)
            generated_sql = sql_data.get("sql")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Failed to parse AI generated SQL.")
            
        if not generated_sql:
            raise HTTPException(status_code=500, detail="AI did not return a valid SQL query.")

        # Basic security check: Only allow SELECT statements
        if not generated_sql.strip().upper().startswith("SELECT"):
            raise HTTPException(status_code=400, detail="Only SELECT queries are allowed for security reasons.")

        # Ensure the query is scoped to the user (Replace the {uid} placeholder)
        generated_sql = generated_sql.replace("{uid}", user['uid'])

        # 2. Execute the generated SQL safely
        result_proxy = db.execute(text(generated_sql))
        columns = result_proxy.keys()
        rows = result_proxy.fetchall()
        
        # Format results as a list of dictionaries
        formatted_results = [dict(zip(columns, row)) for row in rows]
        
        return {
            "status": "success",
            "query_used": generated_sql,
            "data": formatted_results
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))