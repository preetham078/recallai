#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 PROJECT_ID [SERVICE_ACCOUNT_NAME]"
  exit 2
fi

PROJECT_ID=$1
SA_NAME=${2:-github-deployer}
SA_EMAIL=${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com

gcloud config set project "$PROJECT_ID"

echo "Creating service account $SA_EMAIL"
gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub Actions Deployer"

echo "Granting roles to $SA_EMAIL"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser"

KEY_FILE=./key-${SA_NAME}.json
echo "Creating key: $KEY_FILE"
gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL"

echo "Created key file $KEY_FILE. Add it to GitHub Secrets as GCP_SA_KEY and set GCP_PROJECT to $PROJECT_ID."
