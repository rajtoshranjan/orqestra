# Backend Agent Guide

## Architecture

Prefer Django and DRF built-ins: `ViewSet`, `ModelViewSet`, `GenericViewSet`. Avoid ad-hoc implementations when framework primitives exist.

---

## Views

Views must remain thin. Responsible for: permissions, queryset scoping, serializer orchestration, response formatting. No business logic.

---

## Query Logic

All custom query logic belongs in Managers or QuerySets. Never construct queries in views, serializers, or elsewhere.

---

## Permissions

Every user-facing endpoint must enforce:

1. Authentication
2. Capability or role authorization
3. Resource ownership validation

Always scope querysets by organization and access permissions. Never expose unscoped data. Object retrieval must enforce object-level permissions before returning resources.

---

## Serializers

Accumulate validation errors and raise them together. Keep validation centralized in serializers.

---

## Models

Models contain fields, relationships, and lightweight properties only. No request-aware logic in models.

---

## Exceptions

Use existing project exceptions. Never raise raw exceptions from API code. Register reusable errors through the central exception handling system.

---

## Imports

- Within the same Django app: relative imports.
- Across Django apps: absolute imports.

---

## Database

- Prevent N+1 queries. Use `select_related`, `prefetch_related`, `Prefetch` when appropriate.
- Wrap multi-step writes in `transaction.atomic()`.

---

## Dependencies

Prefer existing dependencies. Do not introduce new packages without clear justification.
