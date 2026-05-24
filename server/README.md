## Orqestra Server

The server is a Django REST Framework API that converts saved diagrams into AWS Lambda deployments by calling the AWS CLI.

### Endpoints

- `GET /health`
- `POST /api/plan`
- `POST /api/deploy`

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
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:3001
```

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
python manage.py test
```
