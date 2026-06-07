import React from 'react';
import {
  MousePointer2,
  ShieldAlert,
  Network,
  HardDrive,
  Shield,
  Sparkles,
} from 'lucide-react';
import { MarkerType } from 'reactflow';
import type { DiagramNode, DiagramEdge } from '@/types';
import { registry } from '@/services';
import { Badge, EmptyState } from '@/components/ui';
import { deriveGraphConfigurations } from '@/utils/derivation-engine';
import { createServiceNode, makeId } from '@/utils/diagram';

export type NodeInspectorProps = {
  selectedNode: DiagramNode | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  setNodes?: React.Dispatch<React.SetStateAction<DiagramNode[]>>;
  setEdges?: React.Dispatch<React.SetStateAction<DiagramEdge[]>>;
  onUpdateConfig: (
    updater: (config: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
};

export function NodeInspector({
  selectedNode,
  nodes,
  edges,
  setNodes,
  setEdges,
  onUpdateConfig,
}: NodeInspectorProps) {
  /* Empty state. */
  if (!selectedNode) {
    return (
      <aside className="animate-slide-in-right flex h-full w-[320px] shrink-0 flex-col justify-center border-l border-border bg-card">
        <EmptyState
          title="No node selected"
          description="Select any cloud resource on the canvas to inspect and configure its settings."
          icon={MousePointer2}
          className="px-6"
        />
      </aside>
    );
  }

  const { serviceId, config, validationErrors } = selectedNode.data;

  /* Look up the service definition. */
  const service = registry.find(serviceId);
  if (!service) {
    return (
      <aside className="flex h-full w-[320px] shrink-0 flex-col justify-center border-l border-border bg-card">
        <EmptyState
          title="Unknown service"
          description={`The service type "${serviceId}" is not registered in this system.`}
          icon={MousePointer2}
          className="px-6"
        />
      </aside>
    );
  }

  const hasErrors = Object.values(validationErrors).some(Boolean);
  const ServiceIcon = service.icon;
  const InspectorForm = service.InspectorComponent;

  // Derivation configurations
  const derivations = deriveGraphConfigurations(nodes, edges);
  const derived = derivations[selectedNode.id];

  // Visual connections tracking
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const connections = edges.filter(
    (e) => e.source === selectedNode.id || e.target === selectedNode.id,
  );

  const dependencies = connections
    .map((e) => {
      const otherId = e.source === selectedNode.id ? e.target : e.source;
      return nodeMap.get(otherId);
    })
    .filter(Boolean) as DiagramNode[];

  // Auto-Wiring handlers
  const triggerAutoFix = (type: 'role' | 'network' | 'vpc') => {
    if (!setNodes || !setEdges) return;

    const x = selectedNode.position.x;
    const y = selectedNode.position.y;
    const nextIndex = nodes.length + 1;

    if (type === 'role') {
      const roleNode = createServiceNode(
        'iam-role',
        { x: x - 150, y: y },
        nextIndex,
      );
      setNodes((prev) => [...prev, roleNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: selectedNode.id,
          target: roleNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#f59e0b',
            width: 18,
            height: 18,
          },
          style: { stroke: '#f59e0b', strokeWidth: 2 },
        },
      ]);
    } else if (type === 'network') {
      const vpcNode = createServiceNode(
        'vpc',
        { x: x + 150, y: y - 100 },
        nextIndex,
      );
      const subnetNode = createServiceNode(
        'subnet',
        { x: x, y: y - 150 },
        nextIndex + 1,
      );
      const sgNode = createServiceNode(
        'security-group',
        { x: x - 100, y: y - 100 },
        nextIndex + 2,
      );

      setNodes((prev) => [...prev, vpcNode, subnetNode, sgNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: subnetNode.id,
          target: vpcNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
            width: 18,
            height: 18,
          },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
        {
          id: makeId(),
          source: sgNode.id,
          target: vpcNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
            width: 18,
            height: 18,
          },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
        {
          id: makeId(),
          source: selectedNode.id,
          target: subnetNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
            width: 18,
            height: 18,
          },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
        {
          id: makeId(),
          source: selectedNode.id,
          target: sgNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
            width: 18,
            height: 18,
          },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
      ]);
    } else if (type === 'vpc') {
      const vpcNode = createServiceNode('vpc', { x: x + 180, y: y }, nextIndex);
      setNodes((prev) => [...prev, vpcNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: selectedNode.id,
          target: vpcNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
            width: 18,
            height: 18,
          },
          style: { stroke: '#10b981', strokeWidth: 2 },
        },
      ]);
    }
  };

  const triggerReplaceConnection = (svcId: string) => {
    if (!setNodes || !setEdges) return;

    const badEdge = edges.find((e) => {
      if (e.source !== selectedNode.id && e.target !== selectedNode.id)
        return false;
      const otherId = e.source === selectedNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return (
        selectedNode.data.serviceId === 'lambda' &&
        otherNode?.data.serviceId === 'lambda'
      );
    });

    if (!badEdge) return;

    const sourceId = badEdge.source;
    const targetId = badEdge.target;

    const sourceNode = nodes.find((n) => n.id === sourceId)!;
    const targetNode = nodes.find((n) => n.id === targetId)!;

    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;

    const nextIndex = nodes.length + 1;
    const midNode = createServiceNode(svcId, { x: midX, y: midY }, nextIndex);

    setNodes((prev) => [...prev, midNode]);
    setEdges((prev) => [
      ...prev.filter((e) => e.id !== badEdge.id),
      {
        id: makeId(),
        source: sourceId,
        target: midNode.id,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
          width: 18,
          height: 18,
        },
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      },
      {
        id: makeId(),
        source: midNode.id,
        target: targetId,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
          width: 18,
          height: 18,
        },
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      },
    ]);
  };

  const triggerMoveToVPC = () => {
    if (!setNodes) return;
    const vpc = nodes.find((n) => n.data.serviceId === 'vpc');
    const nextIndex = nodes.length + 1;

    let vpcId = '';
    if (!vpc) {
      const x = selectedNode.position.x - 50;
      const y = selectedNode.position.y - 50;
      const newVpc = createServiceNode('vpc', { x, y }, nextIndex);
      newVpc.style = { width: 440, height: 320 };
      vpcId = newVpc.id;
      setNodes((prev) => [...prev, newVpc]);
    } else {
      vpcId = vpc.id;
    }

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            parentNode: vpcId,
            position: { x: 40, y: 40 },
            data: {
              ...n.data,
              config: {
                ...n.data.config,
                parentId: vpcId,
              },
            },
          };
        }
        return n;
      }),
    );
  };

  // Suggestions compilation
  const suggestions: {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    actionLabel: string;
    actionType:
      | 'role'
      | 'api-gateway'
      | 'dynamodb'
      | 'vpc-subnets'
      | 'lambda-backend'
      | 'lambda-trigger';
  }[] = [];

  const connectedServices = new Set(dependencies.map((d) => d.data.serviceId));

  if (serviceId === 'lambda') {
    if (!connectedServices.has('iam-role')) {
      suggestions.push({
        id: 'lambda-role',
        title: 'Execution Role',
        description:
          'Provide an IAM role with execution permissions for this Lambda.',
        icon: Shield,
        actionLabel: 'Create IAM Role',
        actionType: 'role',
      });
    }
    if (!connectedServices.has('api-gateway')) {
      suggestions.push({
        id: 'lambda-apigw',
        title: 'API Gateway Endpoint',
        description:
          'Expose this Lambda function to the public internet via an API Gateway.',
        icon: Network,
        actionLabel: 'Add API Trigger',
        actionType: 'api-gateway',
      });
    }
    if (!connectedServices.has('dynamodb')) {
      suggestions.push({
        id: 'lambda-ddb',
        title: 'DynamoDB Table',
        description:
          'Store execution results or backend state in a persistent DynamoDB table.',
        icon: HardDrive,
        actionLabel: 'Add DynamoDB Table',
        actionType: 'dynamodb',
      });
    }
  } else if (serviceId === 'vpc') {
    const hasSubnets = nodes.some(
      (n) => n.parentNode === selectedNode.id && n.data.serviceId === 'subnet',
    );
    if (!hasSubnets) {
      suggestions.push({
        id: 'vpc-subnets',
        title: 'Isolated Subnets',
        description:
          'Establish standard public and private subnets inside this VPC container.',
        icon: Network,
        actionLabel: 'Create Subnets',
        actionType: 'vpc-subnets',
      });
    }
  } else if (serviceId === 'api-gateway') {
    const hasTarget = connections.some((e) => e.source === selectedNode.id);
    if (!hasTarget) {
      suggestions.push({
        id: 'apigw-lambda',
        title: 'Backend Handler',
        description:
          'Route incoming API requests to a backend AWS Lambda function.',
        icon: Sparkles,
        actionLabel: 'Connect Backend Lambda',
        actionType: 'lambda-backend',
      });
    }
  } else if (serviceId === 'sqs' || serviceId === 'sns') {
    const hasTarget = connections.some((e) => e.source === selectedNode.id);
    if (!hasTarget) {
      suggestions.push({
        id: 'queue-lambda',
        title: 'Event Worker',
        description: 'Trigger a Lambda function to process incoming messages.',
        icon: Sparkles,
        actionLabel: 'Connect Worker Lambda',
        actionType: 'lambda-trigger',
      });
    }
  }

  const handleSuggestionAction = (
    actionType:
      | 'role'
      | 'api-gateway'
      | 'dynamodb'
      | 'vpc-subnets'
      | 'lambda-backend'
      | 'lambda-trigger',
  ) => {
    if (!setNodes || !setEdges) return;

    const x = selectedNode.position.x;
    const y = selectedNode.position.y;
    const nextIndex = nodes.length + 1;

    if (actionType === 'role') {
      triggerAutoFix('role');
    } else if (actionType === 'api-gateway') {
      const apigwNode = createServiceNode(
        'api-gateway',
        { x: x - 180, y: y },
        nextIndex,
      );
      setNodes((prev) => [...prev, apigwNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: apigwNode.id,
          target: selectedNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6366f1',
            width: 18,
            height: 18,
          },
          style: { stroke: '#6366f1', strokeWidth: 2 },
        },
      ]);
    } else if (actionType === 'dynamodb') {
      const ddbNode = createServiceNode(
        'dynamodb',
        { x: x + 180, y: y },
        nextIndex,
      );
      setNodes((prev) => [...prev, ddbNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: selectedNode.id,
          target: ddbNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
            width: 18,
            height: 18,
          },
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        },
      ]);
    } else if (actionType === 'vpc-subnets') {
      const subPub = createServiceNode('subnet', { x: 40, y: 80 }, nextIndex);
      subPub.data.label = 'Public Subnet';
      subPub.parentNode = selectedNode.id;
      subPub.data.config.parentId = selectedNode.id;

      const subPriv = createServiceNode(
        'subnet',
        { x: 260, y: 80 },
        nextIndex + 1,
      );
      subPriv.data.label = 'Private Subnet';
      subPriv.parentNode = selectedNode.id;
      subPriv.data.config.parentId = selectedNode.id;

      setNodes((prev) =>
        prev
          .map((n) => {
            if (n.id === selectedNode.id) {
              return {
                ...n,
                style: { width: 480, height: 240 },
              };
            }
            return n;
          })
          .concat([subPub, subPriv]),
      );
    } else if (
      actionType === 'lambda-backend' ||
      actionType === 'lambda-trigger'
    ) {
      const lambdaNode = createServiceNode(
        'lambda',
        { x: x + 180, y: y },
        nextIndex,
      );
      setNodes((prev) => [...prev, lambdaNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: makeId(),
          source: selectedNode.id,
          target: lambdaNode.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6366f1',
            width: 18,
            height: 18,
          },
          style: { stroke: '#6366f1', strokeWidth: 2 },
        },
      ]);
    }
  };

  return (
    <aside className="animate-slide-in-right flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-card">
      {/* Header. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
        <div
          className="flex size-7 items-center justify-center rounded-full text-primary"
          style={{ background: `${service.accentColor}18` }}
        >
          <ServiceIcon size={14} className="text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight text-foreground">
            {selectedNode.data.label}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {service.shortName}
          </span>
        </div>
        <Badge
          variant={hasErrors ? 'warning' : 'success'}
          className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium"
        >
          {hasErrors ? 'Needs attention' : 'Valid'}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Resource Overview & Topology Connections */}
        <div className="space-y-3 border-b border-border bg-muted/10 px-3 py-2.5">
          <div>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Readiness & Topology
            </h3>
            {dependencies.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No connections in the canvas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dependencies.map((d) => {
                  const s = registry.find(d.data.serviceId);
                  return (
                    <Badge
                      key={d.id}
                      variant="outline"
                      className="border-border bg-background text-[10px] font-normal"
                    >
                      {s?.shortName || d.data.label}: {d.data.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Validation Alert Box with Auto-Wiring Buttons */}
          {hasErrors && (
            <div className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-[11px] text-destructive-foreground">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert size={12} className="text-destructive" />
                <span>Issues Identified</span>
              </div>
              <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
                {Object.entries(validationErrors)
                  .filter(([, msg]) => Boolean(msg))
                  .map(([key, msg]) => (
                    <li key={key} className="space-y-1">
                      <div>{msg}</div>
                      {key === 'executionRole' && (
                        <button
                          onClick={() => triggerAutoFix('role')}
                          className="mt-0.5 block cursor-pointer rounded bg-amber-500 px-1.5 py-0.5 text-left text-[9px] font-semibold text-white transition-colors hover:bg-amber-600"
                        >
                          Auto-Fix: Create & Connect Role
                        </button>
                      )}
                      {key === 'network' && (
                        <button
                          onClick={() => triggerAutoFix('network')}
                          className="mt-0.5 block cursor-pointer rounded bg-emerald-600 px-1.5 py-0.5 text-left text-[9px] font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          Auto-Fix: Create & Connect VPC Network
                        </button>
                      )}
                      {key === 'vpc' && (
                        <button
                          onClick={() => triggerAutoFix('vpc')}
                          className="mt-0.5 block cursor-pointer rounded bg-emerald-600 px-1.5 py-0.5 text-left text-[9px] font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          Auto-Fix: Create & Connect VPC
                        </button>
                      )}
                      {key === 'placement' && (
                        <button
                          onClick={() => triggerMoveToVPC()}
                          className="mt-0.5 block cursor-pointer rounded bg-emerald-600 px-1.5 py-0.5 text-left text-[9px] font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          Auto-Fix: Move into VPC Container
                        </button>
                      )}
                      {key === 'relationship' && (
                        <div className="mt-1 flex flex-col gap-1">
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                            Consider replacing direct connection with:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: 'eventbridge', label: 'EventBridge' },
                              { id: 'sns', label: 'SNS' },
                              { id: 'sqs', label: 'SQS' },
                              { id: 'step-function', label: 'Step Functions' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() =>
                                  triggerReplaceConnection(item.id)
                                }
                                className="cursor-pointer rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-foreground transition-colors hover:bg-accent/80"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {/* Derived Configurations Section (Read-only) */}
        {derived && Object.keys(derived).length > 0 && (
          <div className="space-y-2 border-b border-border bg-muted/30 px-3 py-2.5">
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Derived Config (From Graph)
            </h3>
            <div className="space-y-1.5 text-[11px]">
              {derived.executionRole && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Shield size={10} /> Role
                  </span>
                  <span
                    className="max-w-[160px] truncate font-mono font-medium text-amber-600"
                    title={derived.executionRole.arn}
                  >
                    {derived.executionRole.name}
                  </span>
                </div>
              )}
              {derived.vpc && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Network size={10} /> VPC
                  </span>
                  <span
                    className="max-w-[160px] truncate font-mono font-medium text-emerald-600"
                    title={derived.vpc.cidrBlock}
                  >
                    {derived.vpc.name}
                  </span>
                </div>
              )}
              {derived.subnets.length > 0 && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="text-muted-foreground">
                    Subnet ({derived.subnets[0].subnetType})
                  </span>
                  <span
                    className="max-w-[140px] truncate font-mono font-medium text-emerald-600"
                    title={derived.subnets[0].cidrBlock}
                  >
                    {derived.subnets[0].name}
                  </span>
                </div>
              )}
              {derived.securityGroups.length > 0 && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="text-muted-foreground">Security Group</span>
                  <span className="max-w-[140px] truncate font-mono font-medium text-emerald-600">
                    {derived.securityGroups[0].name}
                  </span>
                </div>
              )}
              {derived.ecrRepository && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="text-muted-foreground">ECR Repository</span>
                  <span
                    className="max-w-[160px] truncate font-mono font-medium text-amber-600"
                    title={derived.ecrRepository.repositoryUrl}
                  >
                    {derived.ecrRepository.name}
                  </span>
                </div>
              )}
              {derived.efs && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <HardDrive size={10} /> EFS Volume
                  </span>
                  <span className="max-w-[160px] truncate font-mono font-medium text-blue-600">
                    {derived.efs.name}
                  </span>
                </div>
              )}
              {derived.layers.length > 0 && (
                <div className="flex items-center justify-between rounded border border-border/80 bg-background p-1.5 shadow-sm">
                  <span className="text-muted-foreground">Attached Layers</span>
                  <span className="max-w-[160px] truncate font-mono font-medium text-blue-600">
                    {derived.layers.map((l) => l.name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Smart Recommendations */}
            {suggestions.length > 0 && (
              <div className="space-y-2 border-t border-border/40 pt-2">
                <h3 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles size={10} className="animate-pulse text-primary" />
                  Smart Suggestions
                </h3>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => {
                    const SugIcon = suggestion.icon;
                    return (
                      <div
                        key={suggestion.id}
                        className="space-y-1.5 rounded-lg border border-border/80 bg-background/50 p-2.5 shadow-sm transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0 text-primary">
                            <SugIcon size={12} />
                          </div>
                          <div className="space-y-0.5 text-left">
                            <h4 className="text-[11px] font-bold leading-none text-foreground">
                              {suggestion.title}
                            </h4>
                            <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleSuggestionAction(suggestion.actionType)
                          }
                          className="w-full cursor-pointer rounded bg-primary/10 py-1 text-center text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          {suggestion.actionLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Service-Specific Form Settings */}
        <div className="p-3">
          <InspectorForm
            config={config}
            validationErrors={validationErrors}
            onUpdate={(updater) => onUpdateConfig(updater)}
          />
        </div>
      </div>
    </aside>
  );
}
