# Project-Wide Code Quality Guide

## Single Responsibility

Each component, serializer, manager, hook, and permission must have one clear responsibility.

## Variable Naming

No single-character variable names (`s`, `e`, `i`, `v`). Use descriptive but concise names (`service`, `event`, `index`, `value`).

## No Dead Code

Remove obsolete code completely. Do not leave: commented-out code, temporary hacks, unused serializers, unused permissions, unused utilities.

## Comments

- Use comments to explain intent, not implementation.
- Prefer no comments. Add only when explaining non-obvious logic or marking a meaningful block boundary.
- End every comment sentence with a full stop.
- Prefer JSDoc for reusable functions.
