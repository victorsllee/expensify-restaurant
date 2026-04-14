import firebase_admin
from firebase_admin import credentials, storage

def test_upload():
    try:
        cred = credentials.Certificate('firebase-adminsdk.json')
        firebase_admin.initialize_app(cred)
        bucket = storage.bucket("expensify-restaurant.firebasestorage.app")

        blob = bucket.blob("test_upload_firebase.txt")
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