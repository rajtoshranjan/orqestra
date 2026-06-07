/**
 * Semantic Relationship Framework
 *
 * Every edge in the architecture graph must carry infrastructure meaning.
 * Relationships are not arbitrary connections — they represent real dependencies,
 * data flows, security bindings, and operational links between cloud resources.
 *
 * Stored as optional edge.data.relationshipKind. Existing edges without a kind
 * are treated as untyped connections and remain valid.
 */

export const RELATIONSHIP_KIND = {
  /* Invocation / trigger flows. */
  INVOKES: 'invokes',
  TRIGGERS: 'triggers',
  ROUTES_TO: 'routes-to',

  /* Data flows. */
  READS_FROM: 'reads-from',
  WRITES_TO: 'writes-to',
  STREAMS_FROM: 'streams-from',

  /* Messaging. */
  PUBLISHES_TO: 'publishes-to',
  SUBSCRIBES_TO: 'subscribes-to',

  /* IAM / security bindings. */
  ASSUMES_ROLE: 'assumes-role',
  ENCRYPTED_BY: 'encrypted-by',
  AUTHENTICATED_BY: 'authenticated-by',

  /* Network topology. */
  BELONGS_TO_NETWORK: 'belongs-to-network',
  PROTECTED_BY: 'protected-by',
  PEERS_WITH: 'peers-with',
  ROUTED_THROUGH: 'routed-through',

  /* Storage / file systems. */
  MOUNTS: 'mounts',
  BACKED_UP_TO: 'backed-up-to',
  REPLICATES_TO: 'replicates-to',

  /* Compute / containers. */
  USES_IMAGE: 'uses-image',
  RUNS_ON: 'runs-on',

  /* Observability. */
  MONITORED_BY: 'monitored-by',
  LOGGED_TO: 'logged-to',
  TRACED_BY: 'traced-by',

  /* Orchestration. */
  ORCHESTRATED_BY: 'orchestrated-by',
  DELEGATES_TO: 'delegates-to',
} as const;

export type RelationshipKind =
  (typeof RELATIONSHIP_KIND)[keyof typeof RELATIONSHIP_KIND];

/**
 * Describes a valid relationship type between two resources.
 * Used for documentation, validation, and future UI relationship pickers.
 */
export type RelationshipDefinition = {
  kind: RelationshipKind;
  label: string;
  description: string;
  /** Capabilities the source resource must provide (empty = any source). */
  sourceCapabilities?: string[];
  /** Capabilities the target resource must provide (empty = any target). */
  targetCapabilities?: string[];
  /** Specific service IDs valid as source (empty = any). */
  allowedSources?: string[];
  /** Specific service IDs valid as target (empty = any). */
  allowedTargets?: string[];
  /** Whether the relationship carries the same meaning in both directions. */
  bidirectional?: boolean;
};
