# Orqestra Platform Architecture

> This document defines the foundational architecture for Orqestra: a cloud architecture operating system
> that enables visual design, AI-assisted generation, validation, and deployment of cloud infrastructure.

---

## 1. Vision and Philosophy

Orqestra is not a Terraform UI. It is not a CloudFormation builder. It is a **cloud architecture operating
system** — a platform where the architecture graph is the canonical source of truth for everything:
validation, deployment, cost estimation, security analysis, AI reasoning, and human collaboration.

Everything is a projection of the graph.

### Core Principles

**The graph is the source of truth.**
All platform capabilities — validation, Terraform generation, cost estimation, security scanning, AI context,
deployment plans — derive from the architecture graph. Nothing external can diverge from it.

**Cloud resources are plugins.**
The orchestration layer must remain provider-agnostic. AWS, Azure, GCP, and Kubernetes should be
implementations of the framework — not the framework itself.

**Metadata-driven, not code-driven.**
Adding a new cloud resource should require primarily configuration (a service definition), not framework
changes. The framework evolves rarely; service definitions evolve constantly.

**The graph is the language between humans and AI.**
AI agents must be able to read, modify, validate, and generate architectures by operating on the graph
model — not by understanding UI implementation details.

---

## 2. Bounded Contexts

The platform is organized around six bounded contexts. Each owns its domain model and has clear boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Architecture Graph                                   │
│  (Nodes, Edges, Hierarchy, Capabilities, Relationships)                     │
│                      canonical source of truth                               │
└────────────┬────────────────────────────────────────┬────────────────────────┘
             │ read/write                              │ read
             ▼                                         ▼
┌────────────────────────┐             ┌───────────────────────────┐
│   Canvas (UI Layer)    │             │   Agent / AI Layer        │
│ React Flow, Inspector  │             │ Graph Context, AI Ops     │
│ Toolbar, Sidebar       │             │ Recommendations, Generate │
└────────────────────────┘             └───────────────────────────┘
             │                                         │
             ▼                                         ▼
┌────────────────────────┐             ┌───────────────────────────┐
│   Validation Engine    │             │   Deployment Engine       │
│ Rule-based, capability │             │ Graph → Plan → Terraform  │
│ aware, extensible      │             │ Execute → State → Sync    │
└────────────────────────┘             └───────────────────────────┘
             │                                         │
             ▼                                         ▼
┌────────────────────────┐             ┌───────────────────────────┐
│   Service Registry     │             │   Provider Layer          │
│ Single source of truth │             │ AWS, Azure, GCP, K8s      │
│ for all resource defs  │             │ Isolated per provider     │
└────────────────────────┘             └───────────────────────────┘
```

---

## 3. Domain Model

### 3.1 Architecture Graph

The graph is the central domain object. It consists of:

- **Nodes**: Resources (compute, storage, networking, security, etc.)
- **Edges**: Semantic relationships between resources
- **Hierarchy**: Parent-child containment (Region → VPC → Subnet → Lambda)
- **Capabilities**: What each resource provides and requires

```typescript
// Canonical graph types
type DiagramNode = ReactFlowNode<ServiceNodeData>
type DiagramEdge = ReactFlowEdge<DiagramEdgeData>
type ServiceNodeData = { serviceId, label, config, validationErrors }
type DiagramEdgeData = { relationshipKind?: RelationshipKind, label?: string }
```

### 3.2 Service Definition

Every resource in the platform is described by a `ServiceDefinition`. This is the central plugin contract.

```typescript
type ServiceDefinition<TConfig> = {
  // Identity
  id: string                        // Unique service ID (e.g., 'lambda', 's3')
  cloudFormationType: string        // AWS CloudFormation type
  name: string                      // Full display name
  shortName: string                 // Short name for compact UIs
  category: ServiceCategory         // Resource family
  description: string               // Human-readable description

  // Capabilities (what this resource provides/requires)
  capabilities?: {
    provides?: string[]             // Capabilities this resource offers
    requires?: string[]             // Capabilities required for functionality
    optional?: string[]             // Capabilities this resource can use
  }

  // Hierarchy constraints
  allowedParents?: string[]         // Service IDs valid as parents
  requiredParents?: string[]        // Service IDs that MUST be a parent
  forbiddenParents?: string[]       // Service IDs that CANNOT be a parent
  isContainer?: boolean             // Whether this resource can contain others

  // Relationship constraints
  allowedRelationships?: string[]   // Service IDs valid for connections
  forbiddenRelationships?: string[] // Service IDs that CANNOT be connected

  // Config lifecycle
  createDefaultConfig: (index: number) => TConfig
  validate: (config: TConfig, nodes?, edges?) => ServiceValidationErrors
  getDisplayName: (config: TConfig) => string

  // Declarative validation rules (graph-level, run by validation engine)
  validationRules?: ValidationRule[]

  // Cost profile (used by cost estimation engine)
  costProfile?: CostProfile

  // Security scan rules (used by security scanning engine)
  securityRules?: SecurityScanRule[]

  // AI context hints (used by AI context serializer)
  aiHints?: AIHints

  // Deployment metadata
  deploymentHints?: DeploymentHints

  // UI components
  NodeComponent: React.ComponentType<...>
  InspectorComponent: React.ComponentType<...>
  icon: React.ComponentType<...>
  accentColor: string

  // Plan builder
  buildPlanResource: (nodeId, config, connectionCount) => ServicePlanResource
}
```

### 3.3 Relationship Model

Relationships are not arbitrary edges. Every connection in the architecture graph carries semantic meaning.

```typescript
const RELATIONSHIP_KIND = {
  INVOKES: 'invokes',           // Lambda invokes another Lambda (via SFN)
  TRIGGERS: 'triggers',         // S3 triggers Lambda
  READS_FROM: 'reads-from',     // Lambda reads from DynamoDB
  WRITES_TO: 'writes-to',       // Lambda writes to S3
  ASSUMES_ROLE: 'assumes-role', // Lambda assumes IAM Role
  PROTECTED_BY: 'protected-by', // EC2 protected by Security Group
  MOUNTS: 'mounts',             // Lambda mounts EFS
  USES_IMAGE: 'uses-image',     // Lambda uses ECR image
  MONITORED_BY: 'monitored-by', // Lambda monitored by CloudWatch
  ENCRYPTED_BY: 'encrypted-by', // S3 encrypted by KMS
  // ...etc
}
```

### 3.4 Capability Model

Capabilities decouple resource identities from their roles. Instead of hardcoding
"Lambda requires iam-role", the system says "Lambda requires execution-role capability."

```
execution-role       → Provided by: IAM Role
network-attachment   → Provided by: Subnet
network-container    → Provided by: VPC
firewall-config      → Provided by: Security Group
compute-artifact     → Provided by: ECR
file-system          → Provided by: EFS
event-source         → Provided by: API Gateway, SQS, SNS, EventBridge, etc.
lambda-layer         → Provided by: Lambda Layer
monitoring-service   → Provided by: CloudWatch
encryption-key       → Provided by: KMS
secret-store         → Provided by: Secrets Manager
auth-service         → Provided by: Cognito
load-balancer        → Provided by: ALB, NLB
relational-database  → Provided by: RDS, Aurora
cache                → Provided by: ElastiCache
nat-service          → Provided by: NAT Gateway
internet-access      → Provided by: Internet Gateway
routing              → Provided by: Route Table
```

---

## 4. Service Registry

The service registry is the single source of truth for all resource definitions.

**Frontend**: `client/src/services/registry.ts` — Singleton `ServiceRegistry` class.

**Backend**: `server/cloud_services/registry.py` — Singleton `ServiceRegistry` class.

### Registry-Driven Platform

The registry drives every platform capability:

| Platform Feature | Registry Usage |
|---|---|
| Canvas rendering | `registry.getNodeTypes()` → ReactFlow nodeTypes |
| Service catalog | `registry.getByCategory()` |
| Validation | `service.validate` + `service.validationRules` |
| Deployment plans | `service.buildPlanResource` |
| Cost estimation | `service.costProfile.estimate` |
| Security scanning | `service.securityRules` |
| AI context | `service.aiHints` |
| Terraform generation | `handler.to_tofu_resource` |
| Property inspector | `service.InspectorComponent` |
| Search | `registry.getAll()` |
| Relationship suggestions | `service.allowedRelationships` |

### Adding a New Service

1. Create `client/src/services/{name}/` with `types.ts`, `defaults.ts`, `validate.ts`, `{name}-node.tsx`, `{name}-inspector.tsx`, `index.ts`
2. Create `server/cloud_services/providers/aws/{name}_service/handler.py`
3. Register in `client/src/services/index.ts` and `server/cloud_services/apps.py`

**Zero framework code changes required.**

---

## 5. Graph Engine

The `GraphEngine` class is the single place for all graph traversal operations. It must be used instead
of duplicating traversal logic across utilities, validation, derivation, or AI context.

```typescript
class GraphEngine {
  getNode(nodeId): DiagramNode | null
  getParent(nodeId): DiagramNode | null
  getChildren(nodeId): DiagramNode[]
  getAncestors(nodeId): DiagramNode[]
  findAncestor(nodeId, serviceId): DiagramNode | null
  getDescendants(nodeId): DiagramNode[]
  getEdgesFor(nodeId): DiagramEdge[]
  getConnectedNodes(nodeId): DiagramNode[]
  getConnectedByServiceId(nodeId, serviceId): DiagramNode[]
  getConnectedByCapability(nodeId, capability): DiagramNode[]
  getNodeContext(nodeId): NodeGraphContext
}
```

**Location**: `client/src/graph/graph-engine.ts`

---

## 6. Validation Framework

### Architecture

Validation operates in three layers:

1. **Config validation** (`service.validate`) — Zod schema validation of resource configuration
2. **Structural validation** (automatic, from `ServiceDefinition`) — placement and relationship checks based on `allowedParents`, `forbiddenParents`, `allowedRelationships`, `forbiddenRelationships`
3. **Architectural rules** (`service.validationRules`) — Declarative graph-level rules using `GraphEngine`

```typescript
// Validation rule interface
type ValidationRule = {
  id: string
  message: string
  severity?: 'error' | 'warning'
  // Returns true if the rule is VIOLATED (error exists)
  check: (context: ValidationContext) => boolean
}

type ValidationContext = {
  node: DiagramNode
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}
```

### Rule Registration Pattern

Validation rules live with their service definitions, not in the validation engine:

```typescript
// services/lambda/index.ts
export const lambdaService: ServiceDefinition<LambdaConfig> = {
  // ...
  validationRules: [
    {
      id: 'lambda-requires-iam-role',
      message: 'AWS Lambda requires an IAM Role connected on the canvas.',
      check: ({ node, nodes, edges }) => {
        // returns true if rule is violated
        return !edges.some(edge => {
          const otherId = edge.source === node.id ? edge.target : edge.source
          return nodes.find(n => n.id === otherId)?.data.serviceId === 'iam-role'
        })
      }
    }
  ]
}
```

### Extension Model

New rules are added to service definitions. The validation engine runs all registered rules generically.
No framework changes are needed to add new validation rules for any service.

---

## 7. Deployment Framework

### Pipeline

```
Graph (nodes + edges + settings)
         │
         ▼
  build_tofu_config()            ← Backend: cloud_services handlers
         │
         ▼
  Deployment record created       ← Backend: deployments app
         │
         ▼
  invoke_deployer()               ← HTTP to deployer service
         │
         ▼
  Terraform plan + apply          ← deployer/ container (OpenTofu)
         │
         ▼
  process_deployment_callback()   ← Deployment state updated
         │
         ▼
  Graph state synchronized        ← DeployedResource records updated
```

### Provider Abstraction

The deployment engine is provider-agnostic. AWS is an implementation, not the framework.

```python
# cloud_services/base.py — provider-agnostic abstract interface
class BaseServiceHandler(ABC):
    service_id: str
    display_name: str
    provider_name: str          # 'aws', 'azure', 'gcp', etc.
    resource_family: str        # 'compute', 'networking', etc.

    def validate(node, nodes, edges) -> list[str]
    def build_plan_resource(node, connection_count) -> dict
    def to_iac_resource(node, settings, nodes, edges) -> dict  # IaC-agnostic name

# cloud_services/providers/aws/base.py — AWS-specific base
class BaseAWSHandler(BaseServiceHandler):
    cloud_formation_type: str   # AWS-specific property isolated here
    provider_name = 'aws'
```

### Supported Deployment Modes

| Mode | Status | Description |
|---|---|---|
| Local (OpenTofu) | ✅ Active | Docker-based deployer container |
| AWS Lambda | 🔜 Planned | Invoke Lambda function for deployment |
| Multi-Cloud | 🔜 Future | Multiple provider execution |
| Drift Detection | 🔜 Planned | Compare graph hash vs deployed state |

---

## 8. AI Framework

### Design Principles

The architecture graph must be the shared language between humans and AI agents.

- AI agents must operate on the **graph model**, not UI implementation details.
- The graph context serializer (`buildGraphContext`) produces a provider-agnostic,
  AI-consumable representation of the architecture.
- Service definitions include `aiHints` that describe resources in terms AI can reason about.

### Graph Context Serialization

```typescript
// utils/graph-context.ts
function buildGraphContext(nodes, edges, projectId, projectName): GraphContext

type GraphContext = {
  projectId: string
  projectName: string
  resources: GraphContextResource[]   // All nodes with AI-friendly metadata
  edges: GraphContextEdge[]           // Semantic edges
  hierarchy: Record<string, string[]> // Parent → children map
  summary: {
    totalResources: number
    byCategory: Record<string, number>
    hasErrors: boolean
    errorCount: number
  }
}
```

### AI Hints Pattern

Every service definition should include `aiHints` to enable AI reasoning:

```typescript
aiHints: {
  summary: 'Serverless compute function that executes code on demand.',
  role: 'Executes business logic in response to events.',
  useCases: ['API handlers', 'Event processors', 'Data transformers'],
  keyAttributes: ['runtime', 'memorySize', 'timeout', 'handler'],
}
```

### Future AI Agent Capabilities

The architecture is designed to support these agent workflows without framework changes:

| Capability | Graph Operations Required |
|---|---|
| Architecture generation | Create nodes, create edges, set parent relationships |
| Architecture explanation | Read graph context, traverse hierarchy |
| Security review | Read nodes + capabilities, run security rules |
| Cost optimization | Read cost profiles, suggest alternatives |
| Infrastructure refactoring | Modify nodes/edges, validate changes |
| Deployment agent | Execute deployment pipeline |
| Drift detection | Compare graph hash vs deployed state |
| Migration agent | Read graph, generate migration plan |

---

## 9. Provider Architecture

### Current State

```
server/cloud_services/
├── base.py              ← Abstract BaseServiceHandler
├── registry.py          ← Service registry singleton
└── providers/
    └── aws/
        ├── base.py      ← BaseAWSHandler (AWS-specific base)
        └── {service}_service/
            └── handler.py
```

### Future Multi-Provider Architecture

```
server/cloud_services/
├── base.py
├── registry.py
└── providers/
    ├── aws/
    │   ├── base.py
    │   └── {service}_service/handler.py
    ├── azure/
    │   ├── base.py
    │   └── {service}_service/handler.py
    ├── gcp/
    │   ├── base.py
    │   └── {service}_service/handler.py
    └── kubernetes/
        ├── base.py
        └── {service}_service/handler.py
```

### Provider Registration

Each provider self-registers by importing its handlers. The central registry is provider-agnostic.
Providers are loaded via Django AppConfig.ready().

---

## 10. Service Family Strategy

Rather than adding all AWS services at once, services are organized into families. Representative services
from each family are implemented first to validate the framework, then coverage expands.

### Service Families and Coverage

| Family | Services | Status |
|---|---|---|
| **Networking** | VPC, Subnet, Security Group, NAT Gateway, Internet Gateway, Route Table, ALB | 🔵 Core done, expanding |
| **Compute** | Lambda, EC2, ECS Cluster | 🔵 Lambda done, expanding |
| **Storage** | S3, EFS | 🔵 Done |
| **Database** | DynamoDB, RDS, ElastiCache | 🔵 DynamoDB done, expanding |
| **Security** | IAM Role, KMS, Secrets Manager, Cognito | 🔵 IAM done, expanding |
| **Integration** | API Gateway, SQS, SNS, EventBridge, Step Functions, Kinesis | 🔵 Done |
| **Monitoring** | CloudWatch | 🔜 Added |
| **Containers** | ECR, Lambda Layer | 🔵 Done |
| **Machine Learning** | SageMaker, Bedrock | 🔜 Future |
| **Analytics** | Redshift, Athena, Glue | 🔜 Future |
| **Developer Tools** | CodePipeline, CodeBuild, CodeDeploy | 🔜 Future |
| **Management** | CloudFormation, Config, CloudTrail | 🔜 Future |

---

## 11. Extensibility Model

### Service Extensibility

The service plugin pattern is the primary extensibility mechanism. To add a new service:

1. **Frontend**: Create `src/services/{name}/` directory with 6 files following the established pattern
2. **Backend**: Create `providers/aws/{name}_service/handler.py` with one class following `BaseAWSHandler`
3. **Registration**: Add imports to `src/services/index.ts` and `apps.py`

The framework derives all behavior from these definitions. No other changes required.

### Validation Extensibility

Validation rules are declared on service definitions. The validation engine is a generic runner.
New rules require zero framework changes.

### Cost Estimation Extensibility

Cost profiles are declared on service definitions. The cost estimator reads `costProfile.estimate`.
New services bring their own cost estimation logic.

### Security Extensibility

Security rules are declared on service definitions. The security scanner is a generic runner.
New services declare their own security rules.

### AI Extensibility

AI context is driven by `aiHints` on service definitions and the generic `GraphEngine` API.
AI agents use `buildGraphContext()` to understand any architecture — new services are automatically
included without any AI layer changes.

---

## 12. Relationship Framework

### Semantic Edges

Every edge in the architecture graph carries infrastructure meaning through `RelationshipKind`.

```typescript
const RELATIONSHIP_KIND = {
  INVOKES: 'invokes',
  TRIGGERS: 'triggers',
  READS_FROM: 'reads-from',
  WRITES_TO: 'writes-to',
  STREAMS_FROM: 'streams-from',
  ROUTES_TO: 'routes-to',
  PUBLISHES_TO: 'publishes-to',
  SUBSCRIBES_TO: 'subscribes-to',
  ASSUMES_ROLE: 'assumes-role',
  ENCRYPTED_BY: 'encrypted-by',
  AUTHENTICATED_BY: 'authenticated-by',
  BELONGS_TO_NETWORK: 'belongs-to-network',
  PROTECTED_BY: 'protected-by',
  PEERS_WITH: 'peers-with',
  ROUTED_THROUGH: 'routed-through',
  MOUNTS: 'mounts',
  BACKED_UP_TO: 'backed-up-to',
  REPLICATES_TO: 'replicates-to',
  USES_IMAGE: 'uses-image',
  RUNS_ON: 'runs-on',
  MONITORED_BY: 'monitored-by',
  LOGGED_TO: 'logged-to',
  ORCHESTRATED_BY: 'orchestrated-by',
  DELEGATES_TO: 'delegates-to',
}
```

Relationship kinds are stored as `edge.data.relationshipKind`. Existing edges without this field
are treated as untyped connections and remain valid.

### Relationship Validation (Future)

Future versions will enforce relationship kinds, preventing invalid connections at the edge level —
not just at the node level. The `RelationshipDefinition` type describes valid source/target constraints.

---

## 13. Code Quality Decisions

### Anti-patterns Prohibited

- **Hardcoded service ID checks in framework code**: Use capabilities and validationRules instead
- **`CONTAINER_SERVICE_IDS` hardcoded sets**: Use `service.isContainer` from registry
- **Service-specific logic in validation engine**: Move to `service.validationRules`
- **Service-specific logic in security scanner**: Move to `service.securityRules`
- **Service-specific logic in cost estimator**: Move to `service.costProfile`
- **God objects**: No single component or class handles multiple concerns
- **God files**: `validation-engine.ts` is a generic runner, not a service encyclopedia
- **`any` types**: All graph traversal uses typed DiagramNode, DiagramEdge

### Patterns Required

- **Service definitions as the extension point**: All new behavior via service definition fields
- **GraphEngine for all traversal**: No inline parent-walking loops outside GraphEngine
- **Registry as source of truth**: Never scatter service knowledge outside registry
- **Capability-based coupling**: Services depend on capabilities, not service IDs
- **Declarative over imperative**: Rules, profiles, and hints over imperative switch statements

---

## 14. Testing Strategy

| Layer | What to Test | Test Location |
|---|---|---|
| Graph Engine | Traversal, ancestry, capability lookup | `graph/graph-engine.test.ts` |
| Validation Engine | Rule execution, placement, relationships | `utils/validation-engine.test.ts` |
| Service Definitions | Capabilities, validation rules, cost profiles | `services/{name}/validate.test.ts` |
| Derivation Engine | Config derivation from graph context | `utils/derivation-engine.test.ts` |
| AI Context | Graph serialization completeness | `utils/graph-context.test.ts` |
| Backend Handlers | Validate, build_plan, to_iac | `providers/aws/{name}_service/tests/` |
| Deployment Pipeline | Graph → config → state | `deployments/tests/` |

**Test focus**: behavior and architectural contracts, not implementation details.
**Mock only**: External systems (HTTP calls, AWS APIs). Never mock internal business logic.

---

## 15. Evolution Roadmap

### Phase 1: Foundation ✅ (Current)
- Plugin-based service registry (frontend + backend)
- Capability-based resource model
- Generic validation engine
- Deployment pipeline (Graph → Terraform → Execute)
- Basic service family coverage

### Phase 2: Platform Depth 🔵 (In Progress)
- Semantic relationship framework
- Graph Engine abstraction
- AI context serialization
- Enhanced service definitions (validationRules, costProfile, securityRules, aiHints)
- Expanded AWS service coverage per family

### Phase 3: AI Integration 🔜
- AI architecture generation endpoint
- Graph-based AI context API
- Validation-aware AI suggestions
- Cost optimization recommendations
- Security review agents

### Phase 4: Multi-Cloud 🔜
- Azure provider
- GCP provider
- Kubernetes provider
- Cross-cloud architecture composition

### Phase 5: Autonomous Infrastructure 🔜
- Approval pipelines
- Human + agent collaboration
- Autonomous deployment agents
- Drift detection and remediation
- Multi-agent architecture workflows
