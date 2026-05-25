# AI Agent System Instructions & Repository Rules (`agent.md`)

Welcome, AI Agent! This document contains the **strict repository rules, architectural specifications, and mandatory command instructions** for developing on the **Orqestra** platform.

You must parse this file fully, store these rules in your context, and verify that all your plans and edits adhere to them.

---

## 1. Core Repository Rules

### Rule 1: Directory Separations
- **Frontend SPA**: Kept entirely inside the `client/` directory.
- **Django Server**: Kept entirely inside the `server/` directory.
- **Root Configurations**: Do not pollute the root directory. Keep it limited to `docker-compose.yml`, `.gitignore`, `.env`, and `agent.md`.

### Rule 2: Strict Casing & Translation Boundary
- **Client (TypeScript)**: Standard `camelCase` naming conventions.
- **Server (Python/Django)**: **100% strict `snake_case` properties.** This applies to all Django models, serializer parameters, environment variables, utility methods, validations, test payloads, and DB fields. 
- **The Translator**: Casing translation occurs *strictly* on the frontend API boundary. Use `camelToSnakeRecursive` and `snakeToCamelRecursive` in [client/src/api/types.ts](file:///Users/rajtosh/Documents/projects/draw-to-deploy/client/src/api/types.ts) for all request/response mapping. **Never send camelCase payloads to the Django server.**

### Rule 3: RESTful Routing Without `/api/` Prefixes
- To maintain standard, clean routes, **do not prefix backend endpoints with `/api/`**. 
  - **CORRECT**: `/projects/`, `/plan`, `/deploy`, `/health`
  - **INCORRECT**: `/api/projects/`, `/api/plan`, `/api/deploy`
- Update SPA API clients, constants, and reverse-proxy configurations directly to utilize relative clean paths without `/api/`.

### Rule 4: Decoupled Service Registry Pattern
Both client and server must mirror the Service Registry design to support infinite multi-service scaling:
- **Core Orchestrator (`cloud_services`)**: View endpoints (`/health`, `/plan`, `/deploy`) and orchestrations must be **completely generic** and decoupled from service-specific logic, libraries, or binaries (like `aws` CLI or `zip`). They only interact with the abstract `BaseServiceHandler` interface.
- **Modular Service Providers**: Do not create separate Django apps for each service plugin. All service-specific configurations, serializers, services, deployment packaging, and unit tests must reside strictly inside structured subdirectories under the `cloud_services/providers/` directory tree:
  - e.g., `server/cloud_services/providers/aws/lambda_service/`
- **Dynamic Registry Self-Registration**: Services register with the singleton registry by being imported inside the application's configuration hook:
  ```python
  # server/cloud_services/apps.py
  def ready(self):
      import cloud_services.providers.aws.lambda_service.handler  # noqa: F401
  ```

### Rule 5: Pure REST Retrieval (Detail Actions)
- Adhere strictly to clean REST architectures. Retrieving single entities by their unique identifier must use standard route-based retrieve/detail paths instead of custom query parameter lookups:
  - **CORRECT**: `/projects/<uuid>/` (handled via standard retrieve action)
  - **INCORRECT**: `/projects/?project_id=<uuid>` (avoid redundant query filtering inside list view querysets)

### Rule 6: Non-Blocking Autosave & Invalidation
To prevent server overload and infinite API request loops during real-time autosave:
- **No Invalidation on Save**: Never call query invalidations (`qc.invalidateQueries(['project', projectId])`) on mutation success inside `useUpdateProject`. Instead, update the cache directly using `qc.setQueryData(['project', projectId], data)`.
- **Ref-Based Canvas Dirty Checking**: Inside the canvas editor `useEffect` autosave check, always compare the current layout against a stable React Ref (`originalProjectRef`) rather than the dynamic query state `initialProject`. Update this ref value strictly upon successful save persistence to halt the debouncing loop.

### Rule 7: Reusable Design System & UI Architecture (ShadCN UI)
- **Unified Design System**: All reusable atomic UI primitives (e.g., `Button`, `Input`, `Badge`, `Card`, `Dialog`, `Sheet`, `Tabs`, `DropdownMenu`, `Tooltip`, `Popover`) and molecular presentation components (e.g., `EmptyState`, `LoadingState`, `ConfirmDialog`, `PageHeader`, `SearchBar`) **MUST** live strictly inside the `client/src/components/ui/` directory.
- **Composition over Duplication**: Before creating any new UI element, always check if a similar primitive already exists in `components/ui/`. Prefer extending existing variants/sizes or using composition instead of creating duplicate implementations of the same UI pattern.
- **Avoid Wrapper Hell**: Do not create unnecessary visual wrappers (like `PrimaryButton`, `FancyDialog`, `CustomSheet`) unless they encapsulate meaningful business behavior. Prefer standard composition: `<Button variant="default" />` instead of `<PrimaryButton />`.
- **Zero Business Logic in Primitives**: UI components inside `components/ui/` must remain presentation-focused, reusable, and free of business/domain coupling.
- **Zero Arbitrary Tailwind Values**: Avoid using inline arbitrary tailwind overrides (like `px-[13px]`, `rounded-[11px]`, or custom hex colors). Always utilize the semantic design tokens and variables defined in `client/src/assets/styles.css` (`border-border`, `bg-card`, `text-muted-foreground`, etc.) to maintain the unified dark branding.
- **Strict Palette Harmony**: Always use the exact same central color palette (Vapor Indigo) for all primary actions and CTAs (such as the main Deploy button), avoiding the use of unrelated colors (like green or success backgrounds) for primary elements to maintain absolute theme harmony.

### Rule 8: Zero Decorative Dividers in Comments
- **No Visual Box-Drawing Characters**: Do not use horizontal lines of unicode divider characters (e.g., `───`, `====`, `****`, or similar block drawing lines) inside comments or files. Keep comments concise, standard, and purely textual.
  - **INCORRECT**: `/* ─── Header ─────────────────────────────────────────────── */`
  - **CORRECT**: `/* Header section */`

### Rule 9: React/TypeScript Code Quality Standards
- **Use `type` instead of `interface`**: Declare component props using the `type` alias instead of `interface` (e.g., `type ComponentProps = { ... }`).
- **Strict kebab-case File Naming**: All React components, page containers, assets, schemas, hooks, and style documents must use strict `kebab-case` filenames.
- **Nullish Coalescing for Environment Fallbacks**: Always use the nullish coalescing operator `??` instead of the logical OR `||` when defining fallbacks for environment variables (e.g. `VITE_API_URL` inside `env-variables.ts`).

### Rule 10: Redux Toolkit State Management
- **No Prop Drilling**: Avoid passing parent states down multiple layers of React components. Utilize standard Redux state slices for global, asynchronous, and cross-cutting UI/functional states.
- **Slices Structure**:
  - `editorSlice`: Holds canvas-related states (`projectName`, `nodes`, `edges`, `snapToGrid`, `lastSavedAt`, `clipboard`).
  - `deploymentSlice`: Holds `deploymentResult` (status, logs, lastRunAt) and settings (region, executionRoleArn).
  - `uiSlice`: Holds workspace presentation states (`sidebarCollapsed`, `deployDrawerOpen`, `contextMenu`).
- **Store Configuration**: Located inside `client/src/store/index.ts` with custom React hooks `useAppSelector` and `useAppDispatch` defined in `client/src/store/hooks.ts`.

### Rule 11: Zod & React Hook Form Inspectors
- **Zod Schema Form Validations**: Form schemas must be declared strictly using Zod schemas inside `client/src/schemas/` to ensure robust, real-time feedback for required fields, character limits, formatting, and unique key checks.
- **React Hook Form Binding**: Complex inspector panels must bind form inputs using `useForm` and `useFieldArray` from `react-hook-form` along with `@hookform/resolvers/zod`. Bubble validation status and updated configuration objects reactively back to the main editor canvas on input changes.

### Rule 12: Backend Django Coding & Testing Conventions
- **Django Native Testing Framework**: Always write backend unit tests using Django's native testing utility `django.test.TestCase` (or REST Framework's `APITestCase` subclasses). Do not introduce or use third-party test suites like `pytest` or `pytest-django`.
- **Zero Boilerplate Docstrings**: Avoid adding self-evident, repetitive comments or docstrings that simply re-state obvious framework actions (e.g. "ViewSet for CRUD", "Model serializer", "Support query parameters").
- **Lean Dependencies**: Maintain a clean, minimal dependency footprint. Do not add auxiliary or redundant dependencies (like `sqlparse`) unless they are intentionally integrated and fully utilized in active codebase logic.
- **ORM Native Conventions**: Avoid overriding DB table names (`db_table`) or specifying default ordering properties unless strictly required. Trust Django's implicit convention-over-configuration paradigms for model layouts and automatic migrations.
- **Clean Framework Exceptions**: Do not write custom APIExceptions when the framework already provides built-in alternatives. Utilize standard `rest_framework.exceptions.ValidationError` or `ParseError` classes to handle client errors.

---

## 2. Docker Execution Rules (Mandatory for Commands & Testing)

To guarantee runtime parity and isolate dependencies, **always execute backend checks, database migrations, and testing commands inside Docker containers** rather than on the host machine.

### Core Docker Commands

#### Running Backend System Checks:
```bash
docker compose run --rm server python manage.py check
```

#### Running Backend Unit Tests:
```bash
docker compose run --rm server python manage.py test
```

#### Creating Database Migrations:
```bash
docker compose run --rm server python manage.py makemigrations
```

#### Applying Database Migrations:
```bash
docker compose run --rm server python manage.py migrate
```

#### Running the Full App Stack Locally:
```bash
docker compose up --build
```

---

## 3. Guide: Adding a New Service Provider (e.g. AWS S3)

To extend the platform to support a new service like **AWS S3** (`s3`) within a unified cloud service structure, follow this clean blueprint precisely. Do not create a separate Django app.

### Step 1: Define the Directory Structure
Create a new directory under `server/cloud_services/providers/aws/s3_service/` containing `serializers.py`, `services.py`, `handler.py`, and a `tests/` package.

### Step 2: Implement the Handler (`handler.py`)
```python
from cloud_services.base import BaseServiceHandler
from cloud_services.registry import registry
from .serializers import S3ConfigSerializer
from .services import deploy_s3_bucket

class S3Handler(BaseServiceHandler):
    @property
    def service_id(self) -> str:
        return "s3"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::S3::Bucket"

    @property
    def display_name(self) -> str:
        return "AWS S3 Bucket"

    def get_serializer_class(self):
        return S3ConfigSerializer

    def validate(self, node: dict) -> list[str]:
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("bucket_name", "").strip():
            problems.append(f"S3 Bucket node '{node.get('id')}' is missing a bucket name.")
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("bucket_name", ""),
            "runtime": "n/a",
            "memory_size": 0,
            "timeout": 0,
            "environment_variable_count": 0,
            "connection_count": connection_count,
        }

    def deploy(self, node: dict, settings: dict, logs: list) -> None:
        # Check required commands, then deploy
        from cloud_services.providers.aws.lambda_service.services import ensure_command
        ensure_command("aws")
        deploy_s3_bucket(node, settings, logs)

# Register with the singleton registry
registry.register(S3Handler())
```

### Step 3: Configure Self-Registration (`apps.py`)
Add the S3 handler to the core orchestrator config to load it upon server boot:
```python
# server/cloud_services/apps.py
class CloudServicesConfig(AppConfig):
    ...
    def ready(self):
        # Trigger dynamic registrations
        import cloud_services.providers.aws.lambda_service.handler  # noqa: F401
        import cloud_services.providers.aws.s3_service.handler      # noqa: F401
```

### Step 4: Verify S3 Test Coverage
Create test files (e.g. `tests/test_plan.py`) inheriting from `BaseTestCase` (using `/plan` URLs) and execute tests via Docker:
```bash
docker compose run --rm server python manage.py test cloud_services
```
