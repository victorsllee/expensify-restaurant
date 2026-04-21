import os
from google import genai

def list_models():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        return
        
    client = genai.Client(api_key=api_key)
    try:
        models = client.models.list()
        for m in models:
            print(m)
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == '__main__':
    list_models()
