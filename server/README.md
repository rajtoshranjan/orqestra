# Orqestra Server

Django + DRF backend for Orqestra. It owns organisations, projects, the cloud
service registry, deployment orchestration, annotations, and the AI agent
engine. It runs as an ASGI app (Channels) so real-time deployment and agent
events can be pushed to the editor over WebSockets.

## Apps

| App | Responsibility |
|-----|----------------|
| `accounts` | Users, JWT auth, registration |
| `organisations` | Organisations, members, roles, AWS accounts |
| `projects` | Projects and the persisted architecture graph |
| `cloud_services` | Service handler registry and OpenTofu config generation |
| `deployments` | Deployment records and the deployer handoff |
| `annotations` | Canvas comments, mentions, notifications |
| `realtime` | Channels consumers and event fan-out |
| `agent` | AI agent engine, graph tools, and LLM providers ([docs](../docs/ai-agent.md)) |

## Route prefixes

| Prefix | App |
|--------|-----|
| `/accounts/` | Auth and users (`login/`, `token/refresh/`, …) |
| `/organisations/` | Organisations, members, AWS accounts |
| `/projects/` | Projects and graphs |
| `/deployments/` | Deployment create, retrieve, callback, project state |
| `/annotations/` | Comments, mentions, notifications |
| `/agent/` | Agent conversations, runs, annotation replies |
| `/health`, `/plan` | Service registry health and plan generation |

## Running

The stack is normally run from the repository root:

```bash
docker compose up --build
```

The server listens on port `3001` and reloads on code changes.

Run management commands inside the container:

```bash
docker compose run --rm server python manage.py migrate
docker compose run --rm server python manage.py makemigrations
docker compose run --rm server python manage.py check
```

### Without Docker

```bash
cd server
uv sync
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:3001
```

Dependencies are managed with `uv` against `pyproject.toml` / `uv.lock` — never
`pip` or a `requirements.txt`.

## Configuration

Settings read from the repository-root `.env` (see `.env.template`). Beyond the
database and Django basics:

| Variable | Purpose |
|----------|---------|
| `AGENT_LLM_PROVIDER` | Active LLM provider for the agent: `anthropic` or `gemini` |
| `AGENT_LLM_MODEL` | Model id passed to that provider |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Credentials for the selected provider |

Providers resolve lazily, so the server boots without a key; the agent reports
that it is unconfigured until one is set.

## Tests

```bash
docker compose run --rm server python manage.py test
docker compose run --rm server python manage.py test agent
```

Agent tests use a fake LLM provider (`agent/tests/fakes.py`) — no API key or
network access required.

## Conventions

See [AGENTS.md](../AGENTS.md) and [docs/agents/backend.md](../docs/agents/backend.md).
