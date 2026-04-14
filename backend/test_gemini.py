import os
import vertexai
from vertexai.generative_models import GenerativeModel

def test_gemini():
    print("Testing Gemini Pro call...")
    try:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-service-account.json'
        vertexai.init(project='victors-code-editor', location='us-central1')
        model = GenerativeModel(model_name="gemini-1.0-pro")
        response = model.generate_content("Say hello world")
        print(f"✅ Gemini Response: {response.text}")
    except Exception as e:
        print(f"❌ Gemini error: {e}")

if __name__ == '__main__':
    test_gemini()