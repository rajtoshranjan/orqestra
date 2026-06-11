import React from 'react';
import { MarkerType } from 'reactflow';
import type { DiagramNode, DiagramEdge } from '@/types';

type UseEnrichedEdgesOptions = {
  edges: DiagramEdge[];
  nodes: DiagramNode[];
};

export function useEnrichedEdges({ edges, nodes }: UseEnrichedEdgesOptions) {
  const enrichedEdges = React.useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return edges.map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) return edge;

      const isHidden = !!(sourceNode.hidden || targetNode.hidden);
      const sourceSvc = sourceNode.data?.serviceId;
      const targetSvc = targetNode.data?.serviceId;

      let label = '';
      let animated = false;
      let stroke = '#94a3b8';
      let strokeDasharray: string | undefined = undefined;

      if (targetSvc === 'lambda') {
        const triggers = [
          'api-gateway',
          'sqs',
          'sns',
          'dynamodb',
          's3',
          'eventbridge',
          'kinesis',
        ];
        if (triggers.includes(sourceSvc)) {
          label = 'Triggers';
          animated = true;
          stroke = '#6366f1';
        }
      } else if (sourceSvc === 'lambda') {
        if (targetSvc === 'iam-role') {
          label = 'Executes As';
          stroke = '#f59e0b';
        } else if (targetSvc === 'efs') {
          label = 'Mounts';
          animated = true;
          stroke = '#3b82f6';
          strokeDasharray = '5,5';
        } else if (targetSvc === 'lambda-layer') {
          label = 'Uses';
          stroke = '#3b82f6';
        } else if (targetSvc === 'ecr') {
          label = 'Uses Image';
          stroke = '#f59e0b';
        } else if (['vpc', 'subnet', 'security-group'].includes(targetSvc)) {
          label = 'Hosted In';
          stroke = '#10b981';
        } else if (
          ['sqs', 'sns', 'eventbridge', 'lambda'].includes(targetSvc)
        ) {
          label = 'Routes To';
          animated = true;
          stroke = '#8b5cf6';
        }
      } else if (sourceSvc === 'subnet' && targetSvc === 'vpc') {
        label = 'Subnet Of';
        stroke = '#10b981';
      } else if (sourceSvc === 'security-group' && targetSvc === 'vpc') {
        label = 'Rules In';
        stroke = '#10b981';
      }

      return {
        ...edge,
        label,
        animated,
        hidden: isHidden,
        zIndex: 500,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: stroke,
        },
        style: { stroke, strokeWidth: 2, strokeDasharray },
        labelStyle: {
          fill: '#94a3b8',
          fontSize: '7.5px',
          fontWeight: 'bold',
        },
        labelBgStyle: {
          fill: 'var(--color-bg-base)',
          fillOpacity: 0.85,
          rx: 4,
          ry: 4,
        },
      };
    });
  }, [edges, nodes]);

  return { enrichedEdges };
}
