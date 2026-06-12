Continuous Integration / GitHub Actions
-------------------------------------

This repo includes a sample GitHub Actions workflow that builds a Docker image, pushes it to Container Registry, and deploys to Cloud Run. The workflow expects these repository secrets:
- `GCP_SA_KEY` — JSON service account key (see below how to create).
- `GCP_PROJECT` — your Google Cloud project ID.

Create a service account and give it the minimum roles required to build and deploy:
```bash
gcloud iam service-accounts create github-deployer --display-name="GitHub Actions Deployer"

PROJECT_ID=YOUR_PROJECT_ID
SA_EMAIL=github-deployer@$PROJECT_ID.iam.gserviceaccount.com

# Grant roles needed to push images and deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/storage.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser"

# Create a key and save it locally
gcloud iam service-accounts keys create key.json --iam-account=$SA_EMAIL
```
Add the contents of `key.json` to your repository secrets as `GCP_SA_KEY` (GitHub → Settings → Secrets). Add your `GCP_PROJECT` as a secret as well.

Artifact Registry (optional)
---------------------------

If you prefer Artifact Registry over Container Registry:
```bash
gcloud services enable artifactregistry.googleapis.com
gcloud artifacts repositories create recallai-repo --repository-format=docker --location=us-central1 --description="Docker repo"
```
Cloud Build GitHub trigger
--------------------------

If you want Cloud Build to run your `cloudbuild.yaml` on pushes, use the `CLOUD_BUILD_TRIGGER.md` script or the following commands:
```bash
# Create a GitHub connection (opens browser to grant permissions)
gcloud alpha builds connections create github --name="github-connection"

# Create the trigger (replace REPO_OWNER and REPO_NAME)
gcloud beta builds triggers create github \
  --name="recallai-trigger" \
  --repo-owner="REPO_OWNER" \
  --repo-name="REPO_NAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --region="us-central1"
```
GitHub Actions workflow
-----------------------

Place the workflow file at `.github/workflows/gcloud-run-deploy.yml`. It uses the service account key stored in `GCP_SA_KEY` to authenticate and deploy.

If you want, I can add the workflow file to the repo — tell me and I'll create it now.
# Deploy to Google Cloud Run

Prerequisites:
- Install the Google Cloud SDK: https://cloud.google.com/sdk
- Have a Google Cloud project and billing enabled.

Quick deploy using source builds (Cloud Build + Cloud Run):

1. Authenticate and select project:

```bash
gcloud auth login
gcloud config set project PROJECT_ID
```

2. Enable required APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
```

3. Deploy from source (Cloud Build will build the container):

```bash
gcloud run deploy recallai-service \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated
```

Notes:
- The `Dockerfile` in the repo will be used. Cloud Run sets `PORT` automatically; the app listens on `process.env.PORT`.
- If you prefer to build locally and push an image, build and push to Artifact Registry or Container Registry and then `gcloud run deploy --image=IMAGE_URL`.

Example build+deploy using local Docker image + Container Registry:

```bash
# build
docker build -t gcr.io/PROJECT_ID/recallai:latest .
# push
docker push gcr.io/PROJECT_ID/recallai:latest
# deploy
gcloud run deploy recallai-service --image gcr.io/PROJECT_ID/recallai:latest --region=us-central1 --platform=managed --allow-unauthenticated
```

Environment variables:
- To set secrets or env vars (OPENAI_API_KEY, DATABASE_URL, ALLOWED_ORIGIN, etc):

```bash
gcloud run services update recallai-service --update-env-vars "OPENAI_API_KEY=xxx,DATABASE_URL=postgres://..."
```

If you want App Engine instead, let me know and I can add an `app.yaml`.
