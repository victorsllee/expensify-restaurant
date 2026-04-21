import os
from google import genai

def test_api_key():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY not set")
        return
        
    client = genai.Client(api_key=api_key)
    
    # Try models from the LISTED output
    models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-flash-latest"]

    
    for model_name in models_to_try:
        print(f"\nTesting model: {model_name}")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents="Hello"
            )
            print(f"✅ Success with {model_name}: {response.text}")
            return
        except Exception as e:
            print(f"❌ Failed with {model_name}: {e}")

if __name__ == "__main__":
    test_api_key()
