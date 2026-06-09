# Frontend Agent Guide

## File Naming

All filenames: kebab-case.

```
deployment-panel.tsx   validation-service.ts   use-project-details.ts
```

Never: `DeploymentPanel.tsx` or `deploymentPanel.tsx`.

---

## Component Organization

- Organize by module ownership, not by type.
- Page-specific components live inside the page directory (e.g., `client/src/pages/editor/`), not in `components/`.
- `components/` is for truly generic, reusable UI primitives only (layout wrappers, base nodes, UI primitives).
- Never create a global components folder for feature-specific components.

---

## Component Design

- Split responsibilities: components, hooks, utilities, services.
- Avoid render helper functions — extract a component instead.
- Use compound components when appropriate.

---

## UI Components

Always use shadcn components from `components/ui` instead of native HTML elements (`<select>`, `<button>`, `<input>`, etc.). If a component is missing from the project design system, add it.

---

## TypeScript

- No `any`. Use existing type utilities before creating new ones.
- Always type: `useState`, `useRef`, function parameters, function returns.
- Use enums or constants instead of hardcoded string comparisons.

---

## Constants

Constants use `SCREAMING_SNAKE_CASE`.

```ts
const OTP_CELL_COUNT = 6;  // correct
const otpCellCount = 6;    // wrong
```

---

## Hooks

- Add explicit cleanup for all event listeners; remove on unmount.
- Audit whether a `useEffect` is actually required before creating one.
- Never derive state from existing state in effects — prefer computed values.

---

## Keyboard Shortcuts

- Register all global keyboard shortcuts via the central `useKeyboardShortcuts` hook.
- Never use ad-hoc `addEventListener` keydown blocks.
- Provide descriptions and categories for all shortcuts.
- Show shortcuts in tooltips or `title` attributes (e.g., `(⌥L)`).

---

## React Query

React Query is the source of truth for server state.

- Never duplicate query results into `useState`, Redux, or Context unless there is a documented business requirement.
- Prefer derived values from query data.

---

## API Mappers

- Never modify existing API mappers unless absolutely required.
- For new payloads: extend existing mappers and follow existing patterns.
- Never rewrite mapper behaviour.
- Available mappers: `apiDataResponseMapper`, `apiPayloadMapper`, `dynamicFieldsPayloadMapper`.
