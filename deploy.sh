#!/bin/bash

# Configuration
PROJECT_ID="victors-code-editor"
REGION="us-central1"
FIREBASE_PROJECT="expensify-restaurant"

# Function to deploy staging
deploy_staging() {
    echo "Deploying to STAGING..."
    
    # 1. Deploy Backend to Cloud Run (Staging)
    # Ensure env-staging.yaml exists and has correct values
    gcloud run deploy backend-staging \
        --image us-central1-docker.pkg.dev/$PROJECT_ID/expensify-repo/backend:latest \
        --region $REGION \
        --allow-unauthenticated \
        --project $PROJECT_ID \
        --env-vars-file backend/env-staging.yaml \
        --set-secrets="/secrets/firebase-adminsdk.json=FIREBASE_ADMINSDK_JSON:1"
    
    BACKEND_URL=$(gcloud run services describe backend-staging --region $REGION --project $PROJECT_ID --format="value(status.url)")
    echo "Staging Backend URL: $BACKEND_URL"
    
    # 2. Update frontend .env.staging
    echo "Updating frontend/.env.staging with BACKEND_URL..."
    # Replace VITE_API_URL in .env.staging
    sed -i '' "s|VITE_API_URL=.*|VITE_API_URL=\"$BACKEND_URL/api\"|g" frontend/.env.staging
    
    # 3. Build and Deploy Frontend (Staging)
    cd frontend
    npm install
    npm run build -- --mode staging
    npx firebase-tools deploy --only hosting:staging --project $FIREBASE_PROJECT
    cd ..
    
    echo "Staging deployment complete!"
}

# Function to deploy production
deploy_production() {
    echo "Deploying to PRODUCTION..."
    
    # 1. Deploy Backend to Cloud Run (Production)
    gcloud run deploy backend \
        --image us-central1-docker.pkg.dev/$PROJECT_ID/expensify-repo/backend:latest \
        --region $REGION \
        --allow-unauthenticated \
        --project $PROJECT_ID \
        --env-vars-file backend/env-production.yaml \
        --set-secrets="/secrets/firebase-adminsdk.json=FIREBASE_ADMINSDK_JSON:1"
    
    BACKEND_URL=$(gcloud run services describe backend --region $REGION --project $PROJECT_ID --format="value(status.url)")
    echo "Production Backend URL: $BACKEND_URL"
    
    # 2. Build and Deploy Frontend (Production)
    cd frontend
    npm install
    npm run build -- --mode production
    npx firebase-tools deploy --only hosting:production --project $FIREBASE_PROJECT
    cd ..
    
    echo "Production deployment complete!"
}

# Main
if [ "$1" == "prod" ]; then
    deploy_production
else
    deploy_staging
fi
