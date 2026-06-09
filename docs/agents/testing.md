# Testing Agent Guide

## Backend

- Use Django's testing framework.
- Extend project base test classes whenever possible.
- Cover: success paths, permission failures, ownership failures, invalid parameters, empty results, cross-organization access.
- Mock external systems only. Never mock internal business logic.

## Frontend

- Write unit tests for helper functions and complex reusable logic.
