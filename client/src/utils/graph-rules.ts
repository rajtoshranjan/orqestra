import { registry } from '@/services';
import type { DiagramNode } from '@/types';

/**
 * Structural rules for wiring and nesting, in one place.
 *
 * Both the human path (drag-to-connect, drag-into-container) and the agent's
 * operations go through these, so an edit the platform considers illegal is refused
 * the same way whoever made it — the canvas raises a toast, the agent gets an
 * error tool result it can correct from. Service-specific rules live in the
 * service definitions (`allowedRelationships`, `forbiddenParents`, …); this
 * module stays generic.
 */

function isAncestor(
  ancestorId: string,
  descendantId: string,
  nodes: DiagramNode[],
): boolean {
  let current = nodes.find((node) => node.id === descendantId);
  const seen = new Set<string>();
  while (current?.parentNode) {
    if (current.parentNode === ancestorId) return true;
    if (seen.has(current.parentNode)) return false; // cycle guard
    seen.add(current.parentNode);
    current = nodes.find((node) => node.id === current!.parentNode);
  }
  return false;
}

/**
 * Why `sourceId` may not connect to `targetId`, or null when it may.
 * The message is written for a human and is also what the agent reads back.
 */
export function checkConnection(
  sourceId: string,
  targetId: string,
  nodes: DiagramNode[],
): string | null {
  if (sourceId === targetId) {
    return 'A resource cannot connect to itself.';
  }

  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (!source) return `Source node "${sourceId}" does not exist.`;
  if (!target) return `Target node "${targetId}" does not exist.`;

  if (
    isAncestor(sourceId, targetId, nodes) ||
    isAncestor(targetId, sourceId, nodes)
  ) {
    return 'Nesting already defines containment, so a direct connection isn’t needed.';
  }

  const sourceService = registry.find(source.data.serviceId);
  if (!sourceService) return null;

  const targetServiceId = target.data.serviceId;
  const isForbidden =
    sourceService.forbiddenRelationships?.includes(targetServiceId) ?? false;
  const hasAllowList = (sourceService.allowedRelationships?.length ?? 0) > 0;
  const isAllowed =
    !hasAllowList ||
    (sourceService.allowedRelationships?.includes(targetServiceId) ?? false);

  if (isForbidden || !isAllowed) {
    return `${sourceService.shortName} can’t connect to ${
      target.data.label || targetServiceId
    }.`;
  }
  return null;
}

/**
 * Why a `serviceId` resource may not nest inside `parentId`, or null when it may.
 * A null `parentId` means the top level, which is always allowed.
 */
export function checkParent(
  serviceId: string,
  parentId: string | null | undefined,
  nodes: DiagramNode[],
): string | null {
  if (!parentId) return null;

  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return `Parent node "${parentId}" does not exist.`;

  const parentService = registry.find(parent.data.serviceId);
  if (!parentService?.isContainer) {
    return `${parent.data.label || parent.data.serviceId} is not a container.`;
  }

  const childService = registry.find(serviceId);
  if (!childService) return null;

  const parentServiceId = parent.data.serviceId;
  if (childService.forbiddenParents?.includes(parentServiceId)) {
    return `${childService.shortName} cannot be placed inside ${parentServiceId}.`;
  }
  const hasAllowList = (childService.allowedParents?.length ?? 0) > 0;
  if (hasAllowList && !childService.allowedParents?.includes(parentServiceId)) {
    return `${childService.shortName} can only be placed inside ${childService.allowedParents?.join(
      ', ',
    )}.`;
  }
  return null;
}
