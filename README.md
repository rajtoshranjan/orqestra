# Draw-to-Deploy
Draw and deploy to AWS

## MVP

This repo now includes:

- a visual React Flow editor for diagramming Lambda-based architecture
- local save/load, copy/paste, validation, and planning
- a local deployment service that turns Lambda nodes into real AWS Lambda deployments through the AWS CLI

## Run

### UI

```bash
cd ui
npm install
npm run dev
```

### Server

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:3001
```

### Docker

```bash
docker compose up --build
```

Then open `http://localhost:8080`.

## Deployment prerequisites

- Python 3.12+
- AWS CLI authenticated with credentials that can manage Lambda
- `zip` installed
- an execution role ARN for new Lambda functions
  - supply it in the UI, or
  - export `AWS_LAMBDA_EXECUTION_ROLE_ARN` before starting the server

## Docker notes

- The compose setup mounts `${HOME}/.aws` into the server container so the AWS CLI can use your local credentials.
- Set `AWS_PROFILE`, `AWS_REGION`, or `AWS_LAMBDA_EXECUTION_ROLE_ARN` in your shell before `docker compose up` if needed.
- The UI is served by nginx and proxies `/api` and `/health` to the Django server container.

Connections are visual-only in this MVP and do not affect deployment ordering yet.
