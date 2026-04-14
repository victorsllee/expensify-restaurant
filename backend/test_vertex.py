import os
from google.cloud import aiplatform

def test_vertex():
    print("Testing Vertex AI Initialization...")
    try:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-service-account.json'
        # The project ID is victors-code-editor
        aiplatform.init(project='victors-code-editor', location='us-central1')
        print("✅ Vertex AI initialized successfully!")
    except Exception as e:
        print(f"❌ Vertex AI error: {e}")

if __name__ == '__main__':
    test_vertex()
