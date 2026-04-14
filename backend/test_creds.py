import os
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import storage

def test_firebase():
    print("Testing Firebase Admin SDK...")
    try:
        cred = credentials.Certificate('firebase-adminsdk.json')
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully!")
    except Exception as e:
        print(f"❌ Firebase error: {e}")

def test_gcp():
    print("\nTesting GCP Storage Client...")
    try:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-service-account.json'
        client = storage.Client()
        # Just listing buckets to test auth
        buckets = list(client.list_buckets(max_results=1))
        print("✅ GCP credentials work, accessed project!")
    except Exception as e:
        print(f"❌ GCP error: {e}")

if __name__ == '__main__':
    test_firebase()
    test_gcp()
