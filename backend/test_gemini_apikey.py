import os
from google import genai
from google.genai import types

def test_gemini_api_key():
    print("Testing Gemini via API Key...")
    try:
        # Initialize the new genai client directly with the API key
        # Note: Do not rely on GOOGLE_APPLICATION_CREDENTIALS for this method.
        # Ensure that GEMINI_API_KEY is read by the client.
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY"))
        
        # We can use gemini-1.5-flash for the fastest OCR/Text tasks
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents='Say "Hello from the new API key!"',
        )
        print(f"✅ Gemini Response: {response.text}")
    except Exception as e:
        print(f"❌ Gemini error: {e}")

if __name__ == '__main__':
    test_gemini_api_key()