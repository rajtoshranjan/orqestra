# Agent Guidelines

## Project Overview

Orqestra is a visual Infrastructure-as-Code platform — "Cursor for DevOps". Users design cloud architectures in a node-based editor; the platform validates, plans, and deploys infrastructure via AI.

Current target: AWS. Designed for multi-cloud from the start.

Primary users: DevOps engineers, including those with limited cloud expertise.

---

## Core Principles

### Canvas Graph Is The Source Of Truth

The infrastructure graph is canonical. All validation, deployment plans, resource dependencies, infrastructure generation, and execution must derive from it. Never introduce infrastructure state that can diverge from the graph.

### Plugin-Based Cloud Architecture

Cloud resources are plugins. The orchestration layer must remain provider-agnostic. Never introduce AWS-specific logic into orchestration code. New resources go through the provider registration system — never via modifications to orchestration code.

### Plugin-Based LLM Layer

The AI agent follows the same rule for models. The engine depends on `BaseLLMProvider` and never imports a vendor SDK; vendor translation lives only in `server/agent/llm/mappers.py`. A new model is a new adapter plus a registration in `agent/apps.py` — never an engine change. The agent acts on the graph only through its grounded ops and the frontend service registry and canvas helpers; never give it a private mutation path.

### Reuse Before Creating

Before writing new code, search for an existing implementation. Reuse existing utilities, components, hooks, serializers, managers, permissions, and API mappers. Match the nearest existing pattern. Consistency over novelty.

### Avoid Patch Fixes (Clean Refactoring Over Hiding Issues)

Do not use "patch fixes" to suppress compilation, typing, or linting warnings/errors (e.g., adding `eslint-disable` or `// @ts-ignore` comments to hide unused variables or type mismatches). If a variable or parameter is unused, clean-remove it. If state properties are duplicate or redundant, refactor the codebase to unify the state rather than writing synchronized duplicate states. follow the same rules with everything in this project

---

## Repository Structure

Monorepo:

- `client/` — all frontend code (agent client: `client/src/agent/`, panel: `client/src/pages/editor/agent-panel.tsx`)
- `server/` — all backend code (agent engine, tools, and LLM providers: `server/agent/`)

---

## API Contract

- Frontend: camelCase. Backend: snake_case.
- Frontend owns payload transformation. Never send camelCase payloads to Django.
- Always use the project's API mapping utilities: `apiDataResponseMapper`, `apiPayloadMapper`, `dynamicFieldsPayloadMapper`.
- Never introduce custom payload transformation logic.

---

## Docker

Run all backend operations through Docker:

```
docker compose run --rm server python manage.py check
docker compose run --rm server python manage.py test
docker compose run --rm server python manage.py makemigrations
docker compose run --rm server python manage.py migrate
```

---

## Pre-Completion Checklist

Before marking any task done:

- [ ] Reused existing patterns, utilities, components, serializers, managers, permissions
- [ ] Types added (frontend) / no raw exceptions (backend)
- [ ] Tests added where required
- [ ] No duplicate state, no N+1 queries
- [ ] Permissions enforced and querysets scoped
- [ ] Business logic in the correct layer
- [ ] Naming conventions followed
- [ ] No dead code or commented-out blocks

---

## Additional Agent Guides

Load these when working in the relevant area:

- `docs/agents/frontend.md` — frontend standards, component rules, React Query, keyboard shortcuts
- `docs/agents/backend.md` — Django/DRF patterns, permissions, database, exceptions
- `docs/agents/testing.md` — testing strategy and base classes
- `docs/agents/project.md` — code quality, naming, comments
- `docs/ai-agent.md` — how the AI agent works: surfaces, run loop, ops, risk model, LLM providers
