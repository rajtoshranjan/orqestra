import React from 'react';
import type { DeploymentNodeStatus } from './canvas-utils';
import type { DiagramNode } from '@/types';
import { getDescendants } from '@/utils';
import { registry } from '@/services';
import { cn } from '@/lib/utils';

type UseEnrichedNodesOptions = {
  nodes: DiagramNode[];
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>;
  deployedGraphNodes: DiagramNode[] | undefined;
  connectingSource: string | null;
  dragOverNodeId: string | null;
};

export function useEnrichedNodes({
  nodes,
  setNodes,
  deployedGraphNodes,
  connectingSource,
  dragOverNodeId,
}: UseEnrichedNodesOptions) {
  const handleToggleCollapse = React.useCallback(
    (nodeId: string) => {
      setNodes((current) => {
        const targetNode = current.find((n) => n.id === nodeId);
        if (!targetNode) return current;

        const nextCollapsed = !targetNode.data.config.isCollapsed;
        const descendants = getDescendants(nodeId, current);

        return current.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                config: { ...n.data.config, isCollapsed: nextCollapsed },
              },
            };
          }
          if (descendants.includes(n.id)) {
            return { ...n, hidden: nextCollapsed };
          }
          return n;
        });
      });
    },
    [setNodes],
  );

  const enrichedNodes = React.useMemo(() => {
    const deployedNodeMap = new Map(
      (deployedGraphNodes ?? []).map((node) => [node.id, node]),
    );

    const sourceNode = connectingSource
      ? nodes.find((n) => n.id === connectingSource)
      : null;
    const sourceService = sourceNode
      ? registry.find(sourceNode.data.serviceId)
      : null;

    const mappedNodes = nodes.map((node) => {
      const lastDeployedNode = deployedNodeMap.get(node.id);

      let deploymentStatus: DeploymentNodeStatus = 'not_deployed';
      if (lastDeployedNode) {
        const currentConfigStr = JSON.stringify(node.data?.config || {});
        const deployedConfigStr = JSON.stringify(
          lastDeployedNode.data?.config || {},
        );
        deploymentStatus =
          currentConfigStr === deployedConfigStr ? 'deployed' : 'dirty';
      }

      let isValidTarget = true;
      if (connectingSource) {
        if (node.id === connectingSource) {
          isValidTarget = false;
        } else if (sourceService) {
          const targetServiceId = node.data.serviceId;
          const isForbidden =
            sourceService.forbiddenRelationships?.includes(targetServiceId);
          const isAllowed =
            !sourceService.allowedRelationships ||
            sourceService.allowedRelationships.includes(targetServiceId);
          isValidTarget = !isForbidden && isAllowed;
        }
      }

      const isDragOver = dragOverNodeId === node.id;
      const connectionClass =
        connectingSource && !isValidTarget
          ? 'opacity-30 pointer-events-none'
          : '';

      return {
        ...node,
        className: cn(node.className, connectionClass),
        data: {
          ...node.data,
          deploymentStatus,
          isDragOver,
          isConnectingActive: !!connectingSource,
          isValidTarget,
          onToggleCollapse: () => handleToggleCollapse(node.id),
        },
      };
    });

    const nodeMapForSorting = new Map(mappedNodes.map((n) => [n.id, n]));
    const getDepth = (nodeId: string): number => {
      let depth = 0;
      let current = nodeMapForSorting.get(nodeId);
      while (current?.parentNode) {
        depth++;
        current = nodeMapForSorting.get(current.parentNode);
      }
      return depth;
    };

    const depths = new Map<string, number>();
    for (const node of mappedNodes) {
      depths.set(node.id, getDepth(node.id));
    }

    const layeredNodes = mappedNodes.map((node) => {
      const depth = depths.get(node.id) || 0;
      const service = registry.find(node.data.serviceId);
      return {
        ...node,
        zIndex: service?.isContainer ? depth + 1 : 1000,
      };
    });

    return layeredNodes.sort(
      (a, b) => (depths.get(a.id) || 0) - (depths.get(b.id) || 0),
    );
  }, [
    nodes,
    deployedGraphNodes,
    connectingSource,
    dragOverNodeId,
    handleToggleCollapse,
  ]);

  return { enrichedNodes, handleToggleCollapse };
}
