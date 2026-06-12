# Create a Cloud Build GitHub trigger

Use these commands to create a GitHub trigger that runs `cloudbuild.yaml` on pushes to `main`.

1. Install and authenticate `gcloud` and enable the Cloud Build API:

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud services enable cloudbuild.googleapis.com
```

2. Create the GitHub App connection (opens browser):

```bash
gcloud alpha builds connections create github --name="github-connection"
```

3. Create the trigger (replace `REPO_OWNER` and `REPO_NAME`):

```bash
gcloud beta builds triggers create github \
  --name="recallai-trigger" \
  --repo-owner="REPO_OWNER" \
  --repo-name="REPO_NAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="us-central1"
```

If the `alpha`/`beta` commands change, you can also create the trigger via the Cloud Console: Cloud Build → Triggers → Create trigger.
