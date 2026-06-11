import { useEffect } from 'react';
import { useWebSocket } from './use-websocket';

export const useDeploymentSubscription = (deploymentId: string | null) => {
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!deploymentId) return;

    subscribe('deployment', deploymentId);
    return () => {
      unsubscribe('deployment', deploymentId);
    };
  }, [deploymentId, subscribe, unsubscribe]);
};
export default useDeploymentSubscription;
