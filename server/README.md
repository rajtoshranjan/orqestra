## Orqestra Server

The server is a Django REST Framework API that converts saved diagrams into AWS Lambda deployments by calling the AWS CLI.

### Endpoints

- `GET /health`
- `POST /plan`
- `POST /deploy`

### Requirements

- Python 3.12+
- AWS CLI installed and authenticated
- `zip` available on the machine
- An execution role ARN for creating new Lambdas
  - pass it from the UI, or
  - export `AWS_LAMBDA_EXECUTION_ROLE_ARN`

### Start (Development)

```bash
cd server
uv sync
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:3001
```

(Or `source .venv/bin/activate` after `uv sync` and drop the `uv run` prefix.)

The default port is `3001`.

### Start (Production)

```bash
uvicorn orqestra.asgi:application --host 0.0.0.0 --port 3001
```

### Docker

```bash
docker compose up --build
```

The server container:

- runs the Django app via uvicorn
- includes `aws` and `zip`
- mounts `${HOME}/.aws` as `/root/.aws`
- listens on internal port `3001`

### Tests

```bash
cd server
uv run python manage.py test
```
