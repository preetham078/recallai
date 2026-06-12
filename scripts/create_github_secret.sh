#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 REPO_OWNER/REPO SECRET_NAME KEY_FILE"
  exit 2
fi

REPO=$1
SECRET_NAME=$2
KEY_FILE=$3

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

echo "Setting GitHub secret $SECRET_NAME for $REPO from $KEY_FILE"
gh secret set "$SECRET_NAME" --body-file "$KEY_FILE" --repo "$REPO"

echo "Secret set."
