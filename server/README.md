## Draw-to-Deploy server

The server is a lightweight Go API that converts the saved diagram into AWS Lambda deployments by calling the AWS CLI.

### Endpoints

- `GET /health`
- `POST /api/plan`
- `POST /api/deploy`

### Requirements

- Go 1.22+
- AWS CLI installed and authenticated
- `zip` available on the machine
- An execution role ARN for creating new Lambdas
  - pass it from the UI, or
  - export `AWS_LAMBDA_EXECUTION_ROLE_ARN`

### Start

```bash
cd server
go run .
```

The default port is `3001`.
