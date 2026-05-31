# Orqestra

Draw, validate, and deploy cloud architectures to AWS directly from your browser. Orqestra is a visual Infrastructure-as-Code platform that enables users to design and deploy cloud architectures using a visual node-based editor and AI. Think of Orqestra as "Cursor for DevOps".

---

## Core Principles & Architecture

### The Canvas Graph is the Source of Truth
The infrastructure graph created by the user is the canonical source of truth. All validation, deployment plans, resource dependencies, and infrastructure generation derive directly from the graph. We do not introduce infrastructure state that can diverge from the graph representation.

### Plugin-Based Cloud Architecture
Cloud resources are treated as plugins, ensuring the core orchestration layer remains completely provider-agnostic. New cloud resources are implemented through the provider registration system rather than modifications to core orchestration code.

### Monorepo Structure
- **Frontend (`client/`)**: Premium Vite + React SPA.
- **Backend (`server/`)**: Lean Django server.

---

## Technical Standards

### Frontend (React & TypeScript)
- **Component Organization**: We favor composition and organize components by module ownership rather than placing feature-specific components in a global folder.
- **Strict File Naming**: All filenames must use `kebab-case` (e.g., `deployment-panel.tsx`).
- **UI & Styling**: Exclusively utilizes Shadcn UI components over native HTML tags to maintain our premium Design System.
- **State Management**: React Query is the source of truth for server state. Redux Toolkit is strictly for client-side canvas and UI state (e.g., `editorSlice`, `deploymentSlice`).
- **API Boundaries**: Frontend handles payload transformation. We strictly enforce `camelCase` in the frontend and `snake_case` in the backend, bridging the gap with dedicated API mappers.

### Backend (Django & DRF)
- **Decoupled Provider Registry**: Plug-and-play provider registration architecture. Services (like AWS Lambda) are registered cleanly under provider-specific plugins.
- **Thin Views & Fat Models/Managers**: Views remain thin and focus on permissions, queryset scoping, and serializer orchestration. Query logic resides in Managers/QuerySets.
- **Security & Permissions**: Every user-facing endpoint enforces authentication, authorization, and resource ownership validation. We never expose unscoped data.
- **Validation**: Centralized in serializers.
- **Docker First**: All backend operations, checks, and migrations must be run through Docker.

---

## Getting Started

### Quick Start with Docker (Recommended)
Orqestra is fully containerized for seamless development and operational parity.

1. **Configure Environment Variables**:
   Copy `.env.template` to `.env` in the root directory:
   ```bash
   cp .env.template .env
   ```
   *Note: Default environment settings, secrets, and database settings are safely isolated inside `.env`.*

2. **Boot the Entire App Stack**:
   ```bash
   docker compose up --build
   ```

3. **Access the Application**:
   Open **`http://localhost:8080`** in your browser.

---

### Manual Setup (Development)

#### 1. Frontend Client
```bash
cd client
npm install
npm run dev
```
*Frontend dev server boots locally on port `8080` (or the next available port).*

#### 2. Backend Django Server
Ensure you have Python 3.12+, `zip` utility, and the AWS CLI installed on your machine.
```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:3001
```
*Backend API server starts locally on port `3001`.*

---

## Verification & Testing

Always execute backend validation and tests inside Docker containers to guarantee operational environment parity:

### Run Backend System Checks:
```bash
docker compose run --rm server python manage.py check
```

### Run Server Unit Tests:
```bash
docker compose run --rm server python manage.py test
```

### Verify Client TypeScript Build:
```bash
npm run build --prefix client
```

---

## Deployment Prerequisites & Local Credentials

- **AWS Credentials**: The Docker Compose setup mounts your host's local `${HOME}/.aws` folder into the server container (`/root/.aws`) so the AWS CLI can utilize your local AWS credentials seamlessly.
- **Execution Role**: To create new AWS resources, supply an IAM execution role ARN directly in the UI inspector or export `AWS_LAMBDA_EXECUTION_ROLE_ARN` inside your `.env` file before booting the stack.
- **Internal Routing**: Frontend relative endpoints route directly using the absolute backend url (configured via `VITE_API_URL` defaulting to `http://localhost:3001`), keeping the route structures clean and lightweight.
