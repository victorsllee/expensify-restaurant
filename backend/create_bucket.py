import os
from google.cloud import storage

def create_bucket():
    try:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-service-account.json'
        client = storage.Client()
        bucket_name = "expensify-receipts-victors"
        bucket = client.create_bucket(bucket_name, location="us-central1")
        print(f"Bucket {bucket.name} created!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    create_bucket()