import firebase_admin
from firebase_admin import credentials
from google.cloud import storage

def list_buckets():
    try:
        # Instead of firebase_admin.storage, use google.cloud.storage with the SA
        client = storage.Client.from_service_account_json('firebase-adminsdk.json')
        buckets = list(client.list_buckets())
        print("Available buckets:")
        for bucket in buckets:
            print(f"- {bucket.name}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")

if __name__ == '__main__':
    list_buckets()