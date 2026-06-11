import React, { createContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EnvVariables } from '@/config';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { WebSocketClient, WebSocketConnectionState } from '@/lib/websocket';

// Prevent duplicate client instances during Vite HMR hot reloads by attaching to window
let clientInstance: WebSocketClient;
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.__websocket_client__) {
    win.__websocket_client__ = new WebSocketClient(EnvVariables.wsUrl);
  }
  clientInstance = win.__websocket_client__;
} else {
  clientInstance = new WebSocketClient(EnvVariables.wsUrl);
}

const globalWebSocketClient = clientInstance;

interface WebSocketContextType {
  subscribe: (group: 'org' | 'project' | 'deployment', id: string) => void;
  unsubscribe: (group: 'org' | 'project' | 'deployment', id: string) => void;
  connectionState: WebSocketConnectionState;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(
  null,
);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<WebSocketConnectionState>('disconnected');

  const client = globalWebSocketClient;

  // Track connection state
  useEffect(() => {
    return client.addStateListener((state) => {
      setConnectionState(state);
    });
  }, [client]);

  // Connect / Disconnect automatically based on auth token presence and changes,
  // and manage the active organisation subscription.
  const prevOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAuthAndSubscriptions = () => {
      const token = localStorageManager.getToken();
      if (token) {
        client.connect(token);

        // Auto-subscribe/unsubscribe to active organisation channel
        const activeOrgId = localStorageManager.getActiveOrgId();
        if (activeOrgId !== prevOrgIdRef.current) {
          if (prevOrgIdRef.current) {
            client.unsubscribe('org', prevOrgIdRef.current);
          }
          if (activeOrgId) {
            client.subscribe('org', activeOrgId);
          }
          prevOrgIdRef.current = activeOrgId;
        }
      } else {
        client.disconnect();
        prevOrgIdRef.current = null;
      }
    };

    checkAuthAndSubscriptions();
    const intervalId = setInterval(checkAuthAndSubscriptions, 2000);

    return () => {
      clearInterval(intervalId);
      // Do not disconnect the global client singleton on unmount to prevent
      // connection abort issues in development (React StrictMode double-mounting).
      // The client.disconnect() will be called inside checkAuthAndSubscriptions
      // if the token is cleared, which is the correct trigger.
    };
  }, [client]);

  // Set up event mapping to React Query invalidation
  useEffect(() => {
    // 1. Deployment status changes
    const unsubDeployment = client.addEventListener(
      'deployment.status_changed',
      (payload) => {
        const { deployment_id, project_id } = payload;
        if (deployment_id) {
          void queryClient.invalidateQueries({
            queryKey: ['deployment', deployment_id],
          });
        }
        if (project_id) {
          void queryClient.invalidateQueries({
            queryKey: ['project-deployments', project_id],
          });
          void queryClient.invalidateQueries({
            queryKey: ['project-deployment-state', project_id],
          });
        }
      },
    );

    // 2. Annotation updates
    const unsubAnnotation = client.addEventListener(
      'annotation.updated',
      () => {
        // Invalidate all annotations query keys (prefix match matches ['annotations', projectId])
        void queryClient.invalidateQueries({ queryKey: ['annotations'] });
      },
    );

    // 3. Notification updates
    const unsubNotification = client.addEventListener(
      'notification.created',
      () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({
          queryKey: ['notificationUnreadCount'],
        });
      },
    );

    return () => {
      unsubDeployment();
      unsubAnnotation();
      unsubNotification();
    };
  }, [client, queryClient]);

  const subscribe = React.useCallback(
    (group: 'org' | 'project' | 'deployment', id: string) => {
      client.subscribe(group, id);
    },
    [client],
  );

  const unsubscribe = React.useCallback(
    (group: 'org' | 'project' | 'deployment', id: string) => {
      client.unsubscribe(group, id);
    },
    [client],
  );

  const contextValue = React.useMemo(
    () => ({
      subscribe,
      unsubscribe,
      connectionState,
    }),
    [subscribe, unsubscribe, connectionState],
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
