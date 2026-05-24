# AI Agent System Instructions & Repository Rules (`agent.md`)

Welcome, AI Agent! This document contains the **strict repository rules, architectural specifications, and mandatory command instructions** for developing on the **Orqestra** platform.

You must parse this file fully, store these rules in your context, and verify that all your plans and edits adhere to them.

---

## 1. Core Repository Rules

### Rule 1: Directory Separations
- **Frontend SPA**: Kept entirely inside the `client/` directory.
- **Django Server**: Kept entirely inside the `server/` directory.
- **Root Configurations**: Do not pollute the root directory. Keep it limited to `docker-compose.yml`, `.gitignore`, and `agent.md`.

### Rule 2: Strict Casing & Translation Boundary
- **Client (TypeScript)**: Standard `camelCase` naming conventions.
- **Server (Python/Django)**: **100% strict `snake_case` properties.** This applies to all Django models, serializer parameters, environment variables, utility methods, validations, test payloads, and DB fields. 
- **The Translator**: Casing translation occurs *strictly* on the frontend API boundary. Use `camelToSnakeRecursive` and `snakeToCamelRecursive` in [client/src/lib/api.ts](file:///Users/rajtosh/Documents/projects/orqestra/client/src/lib/api.ts) for all request/response mapping. **Never send camelCase payloads to the Django server.**

### Rule 3: Fetching via Request Query Parameters
- When querying detailed entity parameters (such as a specific project), always use query parameters instead of raw URL path parameters:
  - **CORRECT**: `/api/projects/?project_id=<uuid>` (handled via request query lookup)
  - **INCORRECT**: `/api/projects/<uuid>/` (unless performing standard PUT/DELETE mutations)

### Rule 4: Decoupled Service Registry Pattern
Both client and server must mirror the Service Registry design to support infinite multi-service scaling:
- **Core Orchestrator (`cloud_services`)**: View endpoints (`/health`, `/api/plan`, `/api/deploy`) and orchestrations must be **completely generic** and decoupled from service-specific logic, libraries, or binaries (like `aws` CLI or `zip`). They only interact with the abstract `BaseServiceHandler` interface.
- **Modular Service Plugins (e.g. `aws_lambda`)**: All service-specific configurations, validations, deployment packaging, and external CLI/SDK dependencies must reside strictly inside the plugin app.
- **App Self-Registration**: Plugins must trigger self-registration dynamically upon application startup by importing their service handler within the `AppConfig.ready()` method (inside `apps.py`).

### Rule 5: Non-Blocking Autosave & Invalidation
To prevent server overload and infinite API request loops during real-time autosave:
- **No Invalidation on Save**: Never call query invalidations (`qc.invalidateQueries(['project', projectId])`) on mutation success inside `useUpdateProject`. Instead, update the cache directly using `qc.setQueryData(['project', projectId], data)`.
- **Ref-Based Canvas Dirty Checking**: Inside the canvas editor `useEffect` autosave check, always compare the current layout against a stable React Ref (`originalProjectRef`) rather than the dynamic query state `initialProject`. Update this ref value strictly upon successful save persistence to halt the debouncing loop.

### Rule 6: Reusable Design System & UI Architecture (ShadCN UI)
- **Unified Design System**: All reusable atomic UI primitives (e.g., `Button`, `Input`, `Badge`, `Card`, `Dialog`, `Sheet`, `Tabs`, `DropdownMenu`, `Tooltip`, `Popover`) and molecular presentation components (e.g., `EmptyState`, `LoadingState`, `ConfirmDialog`, `PageHeader`, `SearchBar`) **MUST** live strictly inside the `client/src/components/ui/` directory.
- **Composition over Duplication**: Before creating any new UI element, always check if a similar primitive already exists in `components/ui/`. Prefer extending existing variants/sizes or using composition instead of creating duplicate implementations of the same UI pattern.
- **Avoid Wrapper Hell**: Do not create unnecessary visual wrappers (like `PrimaryButton`, `FancyDialog`, `CustomSheet`) unless they encapsulate meaningful business behavior. Prefer standard composition: `<Button variant="default" />` instead of `<PrimaryButton />`.
- **Zero Business Logic in Primitives**: UI components inside `components/ui/` must remain presentation-focused, reusable, and free of business/domain coupling.
- **Zero Arbitrary Tailwind Values**: Avoid using inline arbitrary tailwind overrides (like `px-[13px]`, `rounded-[11px]`, or custom hex colors). Always utilize the semantic design tokens and variables defined in `client/src/assets/styles.css` (`border-border`, `bg-card`, `text-muted-foreground`, etc.) to maintain the unified dark branding.

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

## 3. Guide: Adding a New Service Plugin (e.g. AWS S3)

To extend the platform to support a new service like **AWS S3** (`s3`), follow this clean blueprint precisely. Do not modify the `cloud_services` app.

### Step 1: Define the Django App Structure
Create directory `server/aws_s3/` with `apps.py`, `serializers.py`, `services.py`, and `handler.py`.

### Step 2: Configure Self-Registration (`apps.py`)
```python
from django.apps import AppConfig

class AwsS3Config(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "aws_s3"

    def ready(self):
        # Triggers handler self-registration upon startup
        import aws_s3.handler  # noqa: F401
```

### Step 3: Implement the Handler (`handler.py`)
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
        # Check tools, then deploy
        from aws_lambda.services import ensure_command
        ensure_command("aws")
        deploy_s3_bucket(node, settings, logs)

# Register with the singleton registry
registry.register(S3Handler())
```

### Step 4: Register S3 App
Add `"aws_s3"` to `INSTALLED_APPS` inside [server/orqestra/settings.py](file:///Users/rajtosh/Documents/projects/orqestra/server/orqestra/settings.py).

### Step 5: Verify S3 Test Coverage
Create `aws_s3/tests/test_plan.py` inheriting from `BaseTestCase` and execute tests via Docker:
```bash
docker compose run --rm server python manage.py test aws_s3
```
