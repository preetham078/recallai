#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=${1:-}
REPO_OWNER=${2:-}
REPO_NAME=${3:-}
TRIGGER_NAME=${4:-recallai-trigger}
CONNECTION_NAME=${5:-github-connection}

if [[ -z "$PROJECT_ID" || -z "$REPO_OWNER" || -z "$REPO_NAME" ]]; then
  echo "Usage: $0 PROJECT_ID REPO_OWNER REPO_NAME [TRIGGER_NAME] [CONNECTION_NAME]"
  exit 2
fi

gcloud config set project "$PROJECT_ID"

echo "Creating GitHub connection (interactive browser)"
gcloud alpha builds connections create github --name="$CONNECTION_NAME"

echo "Creating Cloud Build trigger $TRIGGER_NAME for $REPO_OWNER/$REPO_NAME"
gcloud beta builds triggers create github \
  --name="$TRIGGER_NAME" \
  --repo-owner="$REPO_OWNER" \
  --repo-name="$REPO_NAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="us-central1"

echo "Trigger created. Verify in the Cloud Console: Cloud Build → Triggers."
