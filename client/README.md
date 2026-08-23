# Orqestra Client

React + TypeScript frontend for Orqestra: the node-based architecture canvas,
property inspectors, validation and cost feedback, deployment UI, canvas
comments, and the AI agent panel.

Built with Vite, React Flow, Redux Toolkit, React Query, Tailwind, and
shadcn/ui-style Radix primitives.

## Running

Normally started from the repository root with the rest of the stack:

```bash
docker compose up --build     # http://localhost:8080
```

Standalone:

```bash
cd client
npm install
npm run dev
```

`VITE_API_URL` (repository-root `.env`) points the client at the API.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc`) and build |
| `npm run lint` | ESLint (`--fix`, zero warnings) plus `tsc` |
| `npm run format` | Prettier, including Tailwind class ordering |
| `npm test` | Vitest |

## Structure

```
src/
├── agent/          # AI agent client: op executor, run loop, risk, inbox, triggers
├── api/            # API clients and payload mappers
├── components/     # Shared UI (ui/ holds the design-system primitives)
├── config/         # App configuration
├── graph/          # GraphEngine — all graph traversal goes through this
├── hooks/          # Shared hooks (incl. useKeyboardShortcuts)
├── pages/          # Routed pages; pages/editor/ is the canvas editor
├── relationships/  # Typed edge definitions (relationshipKind)
├── schemas/        # Zod schemas
├── services/       # One directory per cloud resource + the registry
├── store/          # Redux Toolkit slices
├── types/
└── utils/
```

Two extension points matter most:

* **`services/`** — adding a cloud resource means adding a service definition
  (types, defaults, validation, node component, inspector) and registering it.
  See [docs/architecture.md](../docs/architecture.md).
* **`agent/`** — the client half of the AI agent. The server decides *what* to
  do; the client applies each op through the service registry and the same canvas
  helpers a human edit uses. See [docs/ai-agent.md](../docs/ai-agent.md).

## Conventions

Kebab-case filenames, payload mapping only through `apiDataResponseMapper` /
`apiPayloadMapper` / `dynamicFieldsPayloadMapper`, and keyboard shortcuts only
through `useKeyboardShortcuts`. Full rules:
[AGENTS.md](../AGENTS.md) and [docs/agents/frontend.md](../docs/agents/frontend.md).
