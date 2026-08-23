# Architecture

This document describes how Orqestra is put together: the major services, the core domain model, and the conventions used to extend the platform with new cloud resources.

## Overview

Orqestra is built around a single idea: the **architecture graph** (the canvas of nodes and edges) is the source of truth. Validation, deployment plans, and infrastructure code are all derived from that graph rather than maintained separately.

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   client    │ ───▶ │   server    │ ───▶ │   deployer    │
│  (React)    │ ◀─── │ (Django/DRF)│ ◀─── │  (OpenTofu)   │
└─────────────┘      └─────────────┘      └──────────────┘
                            │
                            ▼
                       ┌─────────┐
                       │ Postgres │
                       └─────────┘
```

* **`client/`** - React + TypeScript frontend. Renders the architecture canvas (React Flow), property inspectors, and validation feedback.
* **`server/`** - Django + DRF backend. Owns organisations, projects, AWS accounts, the cloud service registry, and the AI agent engine. Builds deployment configuration from the graph.
* **`deployer/`** - Standalone service that runs OpenTofu to plan and apply infrastructure changes.
* **`db`** - PostgreSQL database.

For local development, all of these run via `docker-compose.yml` (see the root [README](../README.md)).

## The Architecture Graph

The graph consists of:

* **Nodes** - cloud resources (Lambda, S3, VPC, Subnet, Security Group, etc.), including container resources that hold other nodes (e.g. a VPC contains Subnets).
* **Edges** - relationships between resources, each carrying a semantic `relationshipKind` (e.g. `invokes`, `triggers`, `reads-from`, `mounts`).
* **Hierarchy** - parent/child containment, derived from node nesting on the canvas.

```typescript
type DiagramNode = ReactFlowNode<ServiceNodeData>
type DiagramEdge = ReactFlowEdge<DiagramEdgeData>

type ServiceNodeData = { serviceId, label, config, validationErrors }
type DiagramEdgeData = { relationshipKind?: RelationshipKind, label?: string }
```

All graph traversal (parents, children, ancestors, connected nodes, etc.) goes through `GraphEngine` (`client/src/graph/graph-engine.ts`). New code should use this rather than writing ad-hoc traversal logic.

## Service Definitions (the plugin model)

Every cloud resource is described by a `ServiceDefinition` on the frontend and a matching handler on the backend. This is the main extension point of the platform - adding a new AWS resource is primarily a matter of adding a new service definition, not changing core framework code.

**Frontend** - `client/src/services/{name}/`:

```typescript
type ServiceDefinition<TConfig> = {
  id: string
  cloudFormationType: string
  name: string
  category: ServiceCategory

  // Hierarchy and relationship constraints
  allowedParents?: string[]
  isContainer?: boolean
  allowedRelationships?: string[]

  // Capabilities this resource provides/requires (see below)
  capabilities?: { provides?: string[]; requires?: string[]; optional?: string[] }

  // Config lifecycle
  createDefaultConfig: (index: number) => TConfig
  validate: (config: TConfig, nodes?, edges?) => ServiceValidationErrors
  validationRules?: ValidationRule[]

  // Cost and security
  costProfile?: CostProfile
  securityRules?: SecurityScanRule[]

  // UI
  NodeComponent: React.ComponentType<...>
  InspectorComponent: React.ComponentType<...>

  // Deployment
  buildPlanResource: (nodeId, config, connectionCount) => ServicePlanResource
}
```

The frontend registry (`client/src/services/registry.ts`) is the single lookup point for everything node-related: canvas rendering, the service catalog, validation, cost estimation, security scanning, and the property inspector.

**Backend** - `server/cloud_services/providers/aws/{name}_service/handler.py`:

```python
# cloud_services/base.py
class BaseServiceHandler(ABC):
    service_id: str
    provider_name: str   # currently always "aws"
    resource_family: str

    def validate(node, nodes, edges) -> list[str]
    def build_plan_resource(node, connection_count) -> dict
    def to_iac_resource(node, settings, nodes, edges) -> dict

# cloud_services/providers/aws/base.py
class BaseAWSHandler(BaseServiceHandler):
    cloud_formation_type: str
    provider_name = "aws"
```

The backend registry (`server/cloud_services/registry.py`) mirrors the frontend registry and is used to build deployment plans and Terraform/OpenTofu resources.

### Adding a new service

1. Frontend: create `client/src/services/{name}/` (types, defaults, validation, node component, inspector) and register it in `client/src/services/index.ts`.
2. Backend: create `server/cloud_services/providers/aws/{name}_service/handler.py` and register it in `server/cloud_services/apps.py`.

No changes to the canvas, validation engine, or deployment pipeline should be required.

## Capabilities and Relationships

**Capabilities** decouple resources from each other so the framework doesn't hardcode service IDs. For example, instead of "Lambda requires an IAM Role", a service declares it requires the `execution-role` capability, which IAM Role provides. Examples: `execution-role`, `network-attachment`, `firewall-config`, `file-system`, `event-source`, `encryption-key`.

**Relationships** are typed edges between nodes, defined in `client/src/relationships/`. Each `relationshipKind` (e.g. `invokes`, `triggers`, `reads-from`, `mounts`, `assumes-role`, `protected-by`) carries semantic meaning that validation and deployment logic can rely on. Edges without a `relationshipKind` are treated as untyped connections.

## Validation

Validation runs in three layers:

1. **Config validation** (`service.validate`) - per-resource validation of configuration values.
2. **Structural validation** - automatic, derived from `allowedParents`, `forbiddenParents`, `allowedRelationships`, etc.
3. **Architectural rules** (`service.validationRules`) - declarative graph-level checks using `GraphEngine`, declared alongside the service that owns the rule.

The validation engine itself is a generic runner; new rules live with their service definitions.

## AI Agent

The agent (`server/agent/`) is an actor on the same graph, not a parallel system.
Its reasoning runs server-side; the canvas mutations are materialised by the
client through the frontend service registry and the shared canvas helpers
(`createServiceNode`, parent sizing, `withValidatedData`), so node defaults,
layout, and the React Flow envelope are never duplicated on the backend and the
agent drives the same code paths a human drag-and-drop does.

```
message ──▶ AgentRun ──▶ LLM turn ──▶ graph ops ──▶ client applies via
   ▲          (server)    (provider)   (tool calls)  registry + canvas helpers
   │                                                        │
   └────────── tool results (validation, cost) ◀────────────┘
```

Two abstractions keep this decoupled:

* **`BaseLLMProvider`** (`agent/llm/`) - a vendor-neutral streaming interface plus
  a registry, mirroring the cloud-service provider pattern. The engine never
  imports a vendor SDK; adapters translate in `agent/llm/mappers.py` and nowhere
  else. Selected via `AGENT_LLM_PROVIDER` / `AGENT_LLM_MODEL`.
* **Graph ops** (`agent/tools.py`) - semantic, provider-agnostic operations
  (`add_resource`, `connect`, `configure`, `set_parent`, `remove`, `validate`,
  `estimate_cost`, plus catalog lookups). The model never emits raw IaC and
  selects services by capability, not by hardcoded service ID. Ops are grounded
  by the prompt (built from the project's catalog snapshot and live canvas) and
  by the client executing them through the frontend registry, which turns an
  invalid op into an error tool result the model must correct.

Because `validate()` and `estimate_cost()` are tools, the platform's own
validation, cost, and security engines are the agent's guardrails and its
self-correction signal. Op risk is graded: coarse op-type risk server-side
(`agent/risk.py`), then escalated client-side at apply time from the service's
`costProfile`, which lives on the frontend service definition.

The client applies each turn's ops one at a time so the build is visible as it
happens. The engine also broadcasts run events (`agent.message.delta`,
`agent.tool_call`, `agent.op_applied`, `agent.run.completed`,
`agent.run.failed`) to the project's Channels group — the same transport
deployments use — for observers other than the client driving the run; the
editor panel itself renders from the REST turn loop.

See [ai-agent.md](./ai-agent.md) for the full reference.

## Deployment Pipeline

```
Graph (nodes + edges + AWS account)
        │
        ▼
build_tofu_config()        - server/cloud_services handlers
        │
        ▼
Deployment record created  - server/deployments
        │
        ▼
invoke_deployer()           - HTTP call to the deployer service
        │
        ▼
OpenTofu plan + apply        - deployer/ container
        │
        ▼
Deployment status + deployed resource state synced back
```

A project is associated with an `AWSAccount` (`server/organisations/models.py`), which supplies the credentials and region used when generating and applying the OpenTofu configuration. This allows a single organisation to deploy different projects into different AWS accounts.

## Multi-Tenancy

Orqestra is multi-tenant at the organisation level:

* **Organisations** contain **Projects** and **AWS Accounts**.
* **OrganisationMember** records control who has access to an organisation and with what role.
* Each **Project** is linked to one **AWSAccount**, which is used for deployments.

## Conventions and Anti-Patterns

* Don't hardcode service IDs in framework code (validation engine, graph utilities, etc.) - use capabilities or `service.isContainer` / `validationRules` instead.
* All graph traversal goes through `GraphEngine`, not inline parent-walking loops.
* Cost and security logic lives on the service definition (`costProfile`, `securityRules`), not in the cost estimator or security scanner directly.
* Frontend payload (de)serialization always goes through `apiDataResponseMapper`, `apiPayloadMapper`, and `dynamicFieldsPayloadMapper`.

## Current Scope and Direction

Today, Orqestra targets **AWS** with a growing catalog of services across networking, compute, storage, databases, security, integration, and monitoring (see `client/src/services/` for the full list).

The provider layer (`cloud_services/providers/aws/`) is structured so that additional providers (Azure, GCP, Kubernetes) could be added alongside AWS without changing the core registry, validation, or deployment framework - but this is not yet implemented.

AI-assisted workflows are built on the same abstractions: the agent operates on
the graph model through the service registry and the same canvas helpers and
validation engine human edits use, rather than through a private path of its
own. Today it is reactive (it acts when chatted with or
tagged) and design-time only (it never deploys). A proactive background reviewer
and a server-side op executor - which would let the agent run without a client
present, behind the same op interface - are the intended next steps.
