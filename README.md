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
go run .
```

## Deployment prerequisites

- Go 1.22+
- AWS CLI authenticated with credentials that can manage Lambda
- `zip` installed
- an execution role ARN for new Lambda functions
  - supply it in the UI, or
  - export `AWS_LAMBDA_EXECUTION_ROLE_ARN` before starting the server

Connections are visual-only in this MVP and do not affect deployment ordering yet.
