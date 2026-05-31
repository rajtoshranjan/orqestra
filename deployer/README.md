# Orqestra Deployer

Standalone deployment service that receives OpenTofu configurations from the
Orqestra Django server, executes `tofu init` / `tofu apply`, and reports results
back via a webhook callback.

## Local Development

The deployer runs as a Docker container alongside the Django server:

```bash
docker compose up deployer
```

## AWS Lambda Deployment

This service is designed to be packaged as an AWS Lambda function. The
`handler.py` file contains the Lambda entry point.

## API

### POST /deploy

Accepts a deployment payload and executes the OpenTofu workflow.

**Request body:**

```json
{
  "deployment_id": "uuid",
  "project_id": "uuid",
  "tofu_config": { ... },
  "existing_state": { ... },
  "callback_url": "http://server:3001/deployments/{id}/callback/",
  "aws_credentials": { ... },
  "code_bundles": { ... }
}
```
