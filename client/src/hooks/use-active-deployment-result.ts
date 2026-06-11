import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDeployment, useProjectDeploymentState } from '@/api';
import type { ClientDeployment } from '@/api';
import type { DeploymentResult, DeploymentLogEntry } from '@/types';
import { DeploymentStatus } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveDeploymentId } from '@/store/deployment-slice';
import { toast } from '@/hooks/use-toast';
import { useDeploymentSubscription } from '@/hooks/use-deployment-subscription';

const ACTIVE_SERVER_STATUSES = new Set([
  'pending',
  'generating',
  'invoking',
  'in_progress',
]);

/**
 * Map a server deployment status string to the client DeploymentStatus enum.
 */
const mapServerStatus = (
  serverStatus: ClientDeployment['status'],
): DeploymentStatus => {
  if (serverStatus === 'succeeded') return DeploymentStatus.Success;
  if (serverStatus === 'failed') return DeploymentStatus.Failed;
  if (ACTIVE_SERVER_STATUSES.has(serverStatus))
    return DeploymentStatus.InProgress;
  return DeploymentStatus.Idle;
};

/**
 * Map a server deployment's logs into client-side DeploymentLogEntry[],
 * appending the error message as a trailing log if not already present.
 */
const mapDeploymentLogs = (
  deployment: ClientDeployment,
): DeploymentLogEntry[] => {
  const logs: DeploymentLogEntry[] = deployment.logs.map((log, index) => ({
    id: `${deployment.id}-log-${index}`,
    level: log.level as DeploymentLogEntry['level'],
    message: log.message,
  }));

  if (
    deployment.errorMessage &&
    !logs.some((log) => log.message.includes(deployment.errorMessage))
  ) {
    logs.push({
      id: `${deployment.id}-error`,
      level: 'error',
      message: deployment.errorMessage,
    });
  }

  return logs;
};

/**
 * Build a DeploymentResult from a server deployment response.
 */
const buildDeploymentResult = (
  deployment: ClientDeployment,
): DeploymentResult => ({
  status: mapServerStatus(deployment.status),
  logs: mapDeploymentLogs(deployment),
  lastRunAt: deployment.completedAt || deployment.createdAt,
});

const IDLE_RESULT: DeploymentResult = {
  status: DeploymentStatus.Idle,
  logs: [],
  lastRunAt: null,
};

type UseActiveDeploymentResultReturn = {
  deploymentResult: DeploymentResult;
  isDeploying: boolean;
};

/**
 * Derive the active deployment result directly from React Query data,
 * eliminating the need to sync deployment status into Redux.
 *
 * Uses `useProjectDeploymentState` for the initial/last deployment info
 * and `useDeployment` with polling for the active deployment.
 */
export const useActiveDeploymentResult = (
  projectId: string,
): UseActiveDeploymentResultReturn => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const activeDeploymentId = useAppSelector(
    (state) => state.deployment.activeDeploymentId,
  );

  const { data: deploymentState } = useProjectDeploymentState(projectId);
  useDeploymentSubscription(activeDeploymentId);
  const { data: activeDeployment } = useDeployment(activeDeploymentId);

  // Resume polling if the last deployment is still running on page load.
  const hasResumedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasResumedRef.current || activeDeploymentId) return;

    const lastDeployment = deploymentState?.lastDeployment;
    if (lastDeployment && ACTIVE_SERVER_STATUSES.has(lastDeployment.status)) {
      dispatch(setActiveDeploymentId(lastDeployment.id));
      hasResumedRef.current = true;
    }
  }, [activeDeploymentId, deploymentState, dispatch]);

  // Show toast and invalidate queries on deployment completion.
  const lastActiveStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeDeployment) {
      lastActiveStatusRef.current = null;
      return;
    }

    const currentStatus = activeDeployment.status;
    const previousStatus = lastActiveStatusRef.current;

    if (currentStatus !== previousStatus) {
      lastActiveStatusRef.current = currentStatus;

      if (currentStatus === 'succeeded') {
        toast({
          title: 'Deployment succeeded',
          description:
            'All cloud resources have been successfully provisioned.',
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployment-state', projectId],
        });
      } else if (currentStatus === 'failed') {
        toast({
          title: 'Deployment failed',
          description:
            activeDeployment.errorMessage ||
            'An error occurred during deployment.',
          variant: 'destructive',
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployment-state', projectId],
        });
      }
    }
  }, [activeDeployment, projectId, queryClient]);

  // Derive the result from query data — no Redux dispatch needed.
  const deploymentResult = React.useMemo<DeploymentResult>(() => {
    // Active deployment takes priority (it's the one being polled).
    if (activeDeployment) {
      return buildDeploymentResult(activeDeployment);
    }

    // Fall back to the last completed deployment from the project state.
    const lastDeployment = deploymentState?.lastDeployment;
    if (lastDeployment) {
      return buildDeploymentResult(lastDeployment);
    }

    return IDLE_RESULT;
  }, [activeDeployment, deploymentState]);

  const isDeploying =
    deploymentResult.status === DeploymentStatus.Pending ||
    deploymentResult.status === DeploymentStatus.InProgress;

  return { deploymentResult, isDeploying };
};
