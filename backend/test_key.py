import os
from google import genai

def test_gemini_api_key():
    print("Testing Gemini via API Key...")
    try:
        client = genai.Client(api_key="AIzaSyAKFnfCNLr2gR_ZvpbWPt89D5PXO4TJ3nc")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents='Say "Hello from the new API key!"',
        )
        print(f"✅ Gemini Response: {response.text}")
    except Exception as e:
        print(f"❌ Gemini error: {e}")

if __name__ == '__main__':
    test_gemini_api_key()
