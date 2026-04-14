import os
from google.cloud import storage

def test_upload():
    try:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-service-account.json'
        storage_client = storage.Client()
        bucket_name = "expensify-restaurant.firebasestorage.app" 
        bucket = storage_client.bucket(bucket_name)

        blob = bucket.blob("test_upload.txt")
        blob.upload_from_string("test", content_type="text/plain")
        print("Upload successful!")
        
        blob.make_public()
        print(f"Make public successful! URL: {blob.public_url}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")

if __name__ == '__main__':
    test_upload()