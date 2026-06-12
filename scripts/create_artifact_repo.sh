#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 PROJECT_ID REPO_NAME [LOCATION]"
  exit 2
fi

PROJECT_ID=$1
REPO_NAME=$2
LOCATION=${3:-us-central1}

gcloud config set project "$PROJECT_ID"
gcloud services enable artifactregistry.googleapis.com

echo "Creating Artifact Registry repo $REPO_NAME in $LOCATION"
gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location="$LOCATION" --description="Docker repo for recallai"

echo "Artifact Registry repo created: $LOCATION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
