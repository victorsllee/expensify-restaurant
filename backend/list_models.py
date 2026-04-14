import os
from google import genai

def list_models():
    client = genai.Client(api_key="AIzaSyBHmXZKwsbzlHeDnrGsLVyu-CEt9QvSqQw")
    models = client.models.list()
    for m in models:
        if "flash" in m.name or "pro" in m.name:
            print(m.name)

if __name__ == '__main__':
    list_models()