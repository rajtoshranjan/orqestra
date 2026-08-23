# Getting Started with Orqestra

This guide walks you through setting up and running Orqestra for the first time, configuring local mock credentials, and deploying your first visual cloud architecture.

---

## Prerequisites

Before starting, ensure you have the following installed on your local machine:
- **Git**
- **Docker** (Desktop or Engine)
- **Docker Compose**

---

## Quick Start

### 1. Clone the Repository
Clone the project repository and navigate into the root directory:
```bash
git clone https://github.com/rajtoshranjan/orqestra.git
cd orqestra
```

### 2. Configure Environment Variables
Copy the template environment file to create your local `.env` configuration:
```bash
cp .env.template .env
```
*(The default configuration in `.env.template` is optimized for local development and requires no immediate changes).*

To use the AI agent, add an LLM provider and API key — this is the one value the
template cannot fill in for you:

```bash
AGENT_LLM_PROVIDER=anthropic   # or: gemini
AGENT_LLM_MODEL=<model-id>
ANTHROPIC_API_KEY=<your-key>   # or GEMINI_API_KEY when using gemini
```

Everything else works without it; the agent simply reports that it is not
configured until a key is present. Keys are read server-side only and never
reach the browser.

### 3. Spin Up the Development Stack
Start all components in the background using Docker Compose:
```bash
docker compose up --build
```
This command automatically downloads images, builds container services, runs the database migrations, and exposes the services.

---

## Services Overview

Once the containers are running, the following services are available:

| Service | Description | Local URL |
| :--- | :--- | :--- |
| **`client`** | React & TypeScript frontend application containing the visual node canvas. | [http://localhost:8080](http://localhost:8080) |
| **`server`** | Django REST Framework API orchestrating organization/project states. | [http://localhost:3001](http://localhost:3001) |
| **`db`** | PostgreSQL database container. | `localhost:5433` |
| **`redis`** | Channel layer backing real-time deployment and agent events. | `localhost:6380` |
| **`deployer`** | OpenTofu deployment engine responsible for managing infra state. | [http://localhost:8002](http://localhost:8002) |
| **`ministack`** | AWS emulator mapping cloud API endpoints locally. | [http://localhost:4566](http://localhost:4566) |
| **`stackport`** | Web inspector console for the local AWS emulator. | [http://localhost:8082](http://localhost:8082) |

---

## Step-by-Step Onboarding

### 1. Register a New User
Since the local database is fresh, you need to register a user:
1. Open your browser and navigate to the signup page: [http://localhost:8080/signup](http://localhost:8080/signup).
2. Fill out the registration form to create your account.
3. Upon submission:
   - Your account is created and you are automatically logged in.
   - A Django post-save signal executes to create a default organization named **"{First Name}'s Organisation"** with your user set as the owner.

### 2. Configure Local AWS Credentials
Orqestra requires AWS credentials linked to your organization to perform cloud deployments. For local development, we configure it to target the integrated AWS emulator (`ministack`):

1. Click on **Settings** (or organization settings icon) in the sidebar.
2. Select the **AWS Accounts** tab.
3. Click **Add Account** (or **Link AWS Account**).
4. Fill in the fields with the following emulator parameters:
   - **Account Name**: `Local Emulator` (or `ministack`)
   - **Access Key ID**: `mock-access-key`
   - **Secret Access Key**: `mock-secret-key`
   - **Endpoint URL**: `http://ministack:4566`
     > [!IMPORTANT]
     > You must use `http://ministack:4566` as the endpoint URL instead of `localhost`. Because Orqestra services run within the Docker Compose network, containers access the emulator using its container host name (`ministack`).
5. Save the account settings.

### 3. Design With the AI Agent
If you set an LLM provider and key in your `.env`, you can let the agent draft the architecture instead of starting from a blank canvas:

1. Create a project — on a new, empty project the agent panel opens automatically. You can toggle it any time with **Cmd/Ctrl + J**.
2. Describe what you want to run in plain language, e.g. *"a REST API with a Postgres database and a background job queue"*. The agent asks about the requirements it still needs (workload, scale, data, regions, compliance, budget).
3. Watch it build: nodes appear and get wired on the canvas while the panel narrates each step. Safe edits apply immediately and can be undone like any other canvas change; destructive ones pause and ask for confirmation.
4. Refine in place by tagging the agent in a comment. Press **C** to enter comment mode, click a node, and start the comment with `@orqestra` — for example *"@orqestra put this Lambda in a private subnet"*. The agent makes the change and replies in that thread, and keeps following the thread until you resolve it.

> [!NOTE]
> The agent is design-time only. It builds and edits the architecture graph; you decide when to deploy. See [ai-agent.md](./ai-agent.md) for the details.

### 4. Deploy Your First Project
Now you are ready to deploy the architecture:

1. Navigate to the **Projects** dashboard and click **New Project** (or open the project you built with the agent).
2. Give your project a name (e.g., `My First Infrastructure`).
3. Click on the project settings (gear icon) and select the `Local Emulator` account from the **AWS Account** dropdown. Save settings.
4. Use the canvas editor to drag and drop cloud resources, or ask the agent to add them.
5. Click **Deploy** in the top right corner.
6. Track deployment execution logs in real-time as OpenTofu plans and applies the resources to the emulator.

### 5. Inspecting the Infrastructure
To verify that your resources were provisioned successfully in the emulator:
- Open the Stackport console at [http://localhost:8082](http://localhost:8082).
- View provisioned AWS resources like Lambda functions, IAM roles, S3 buckets, or network subnets created by the deployment.
