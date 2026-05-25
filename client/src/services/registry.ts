import type { ServiceDefinition, ServiceCategory } from './types';

/* Service Registry */

class ServiceRegistry {
  private services = new Map<string, ServiceDefinition<any>>();

  /** Register a service definition. Called once per service at app startup. */
  register<TConfig>(definition: ServiceDefinition<TConfig>): void {
    if (this.services.has(definition.id)) {
      console.warn(
        `[ServiceRegistry] Service "${definition.id}" is already registered. Overwriting.`,
      );
    }
    this.services.set(definition.id, definition);
  }

  /** Get a service definition by ID. Throws if not found. */
  get(serviceId: string): ServiceDefinition<any> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(
        `[ServiceRegistry] Unknown service "${serviceId}". ` +
          `Registered services: ${[...this.services.keys()].join(', ')}`,
      );
    }
    return service;
  }

  /** Get a service definition by ID, or null if not found. */
  find(serviceId: string): ServiceDefinition<any> | null {
    return this.services.get(serviceId) ?? null;
  }

  /** Get all registered services. */
  getAll(): ServiceDefinition<any>[] {
    return [...this.services.values()];
  }

  /** Get services grouped by category. */
  getByCategory(): Map<ServiceCategory, ServiceDefinition<any>[]> {
    const grouped = new Map<ServiceCategory, ServiceDefinition<any>[]>();
    for (const service of this.services.values()) {
      const list = grouped.get(service.category) ?? [];
      list.push(service);
      grouped.set(service.category, list);
    }
    return grouped;
  }

  /** Get all service IDs. */
  getServiceIds(): string[] {
    return [...this.services.keys()];
  }

  /**
   * Build the `nodeTypes` record for ReactFlow.
   * Maps each service's `id + "Node"` to its NodeComponent.
   * e.g. { lambdaNode: LambdaNodeComponent, s3Node: S3NodeComponent }
   */
  getNodeTypes(): Record<string, React.ComponentType<any>> {
    const nodeTypes: Record<string, React.ComponentType<any>> = {};
    for (const service of this.services.values()) {
      nodeTypes[`${service.id}Node`] = service.NodeComponent;
    }
    return nodeTypes;
  }

  /** How many services are registered? */
  get size(): number {
    return this.services.size;
  }
}

/** Singleton registry instance — import this throughout the app */
export const registry = new ServiceRegistry();
