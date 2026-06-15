export type WebSocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected';

export type WebSocketEventListener = (payload: any) => void;
