# Orqestra

Draw, validate, and deploy cloud architectures to AWS directly from your browser. Orqestra is a state-of-the-art SaaS visual diagramming platform integrated with reactive validations and unified deployment microservices.

---

## 🚀 Architectural & Platform Highlights

### 🎨 Premium Frontend (Vite + React SPA)
- **Vapor Indigo Design System**: Beautiful dark-mode UI primitives (ShadCN UI styling, Outfit typography) tailored with smooth micro-animations.
- **Redux Toolkit State Management**: Centralized slice architecture (`editorSlice`, `deploymentSlice`, `uiSlice`) to manage canvas nodes, edges, clipboard selections, and reactive sidebars—completely free of prop drilling.
- **Zod + React Hook Form Inspectors**: Real-time form validations, regex matching, and environment variable constraints bubbling configuration updates dynamically back to the ReactFlow canvas.
- **Pure REST API Client**: Highly optimized API endpoints mapping directly to backend RESTful detail controllers (e.g. `/projects/<uuid>/` retrieve actions) instead of query parameter filter hacks.
- **Kebab-Case Layout**: Strictly standardized file casing across all components and page directories.

### ⚙️ Lean Django Server & Provider Plugins
- **Decoupled Provider Registry**: Plug-and-play provider registration architecture. Services (like AWS Lambda) are registered cleanly under `cloud_services/providers/aws/lambda_service/` rather than polluting Django's app workspace.
- **Implicit Django Conventions**: Trusting convention-over-configuration paradigms for ORM tables and automatic schema migrations.
- **Boilerplate-Free Coding**: Clean, textual comments and highly concise, self-documenting views, models, and serializers.
- **Native Test suite**: Backend code and services tested purely through Django's native unit testing framework (`django.test.TestCase` / `APITestCase`).

---

## 🛠️ Getting Started

### Quick Start with Docker (Recommended)
Orqestra is fully containerized for seamless development and operational parity.

1. **Configure Environment Variables**:
   Copy `.env.template` to `.env` in the root directory:
   ```bash
   cp .env.template .env
   ```
   *Note: Default environment settings, secrets, and database settings are safely isolated inside `.env`.*

2. **Boot the entire App Stack**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
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

## 🧪 Verification & Testing

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

## 🔒 Deployment Prerequisites & Local Credentials

- **AWS Credentials**: The Docker Compose setup mounts your host's local `${HOME}/.aws` folder into the server container (`/root/.aws`) so the AWS CLI can utilize your local AWS credentials seamlessly.
- **Execution Role**: To create new AWS resources, supply an IAM execution role ARN directly in the UI inspector or export `AWS_LAMBDA_EXECUTION_ROLE_ARN` inside your `.env` file before booting the stack.
- **Internal Routing**: Frontend relative endpoints route directly using the absolute backend url (configured via `VITE_API_URL` defaulting to `http://localhost:3001`), keeping the route structures clean and lightweight.
