import os
from google import genai

def test():
    project = "victors-code-editor"
    locations = ["us-central1", "us-east4", "europe-west1"]
    models = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro"]
    
    creds_path = '/Users/victorsllee/expensify-workspace/backend/gcp-service-account.json'
    if os.path.exists(creds_path):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path

    for loc in locations:
        print(f"\n--- Region: {loc} ---")
        client = genai.Client(vertexai=True, project=project, location=loc)
        for m in models:
            try:
                print(f"Testing {m}...")
                res = client.models.generate_content(model=m, contents="hi")
                print(f"✅ SUCCESS: {res.text}")
                return loc, m
            except Exception as e:
                print(f"❌ FAIL: {e}")
    return None

if __name__ == "__main__":
    test()
