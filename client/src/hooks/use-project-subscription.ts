import { useEffect } from 'react';

import { useWebSocket } from './use-websocket';

export const useProjectSubscription = (projectId: string | null) => {
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!projectId) return;

    subscribe('project', projectId);
    return () => {
      unsubscribe('project', projectId);
    };
  }, [projectId, subscribe, unsubscribe]);
};
export default useProjectSubscription;
