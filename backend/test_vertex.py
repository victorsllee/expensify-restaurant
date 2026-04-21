import os
import vertexai
from vertexai.generative_models import GenerativeModel

def test_vertex_models():
    creds_path = '/Users/victorsllee/expensify-workspace/backend/gcp-service-account.json'
    if os.path.exists(creds_path):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
        
    project = "victors-code-editor"
    location = "us-central1"
    
    import google.auth
    credentials, project_id = google.auth.default()
    
    print(f"Auth Project: {project_id}")
    
    from google.cloud import aiplatform_v1
    
    client = aiplatform_v1.ModelServiceClient(
        client_options={"api_endpoint": f"{location}-aiplatform.googleapis.com"}
    )
    
    parent = f"projects/{project}/locations/{location}"
    
    print(f"Listing models for {parent}...")
    try:
        # Note: ModelService.list_models might not show base models
        # We try to use a specific model to see if it exists
        model_name = f"{parent}/publishers/google/models/gemini-1.5-flash"
        print(f"Checking access to: {model_name}")
        # There isn't a direct 'check access' but we can try to get it
        # Actually, let's just try to generate content with gemini-1.5-flash
        # but using the Discovery API or similar?
        pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_vertex_native()
