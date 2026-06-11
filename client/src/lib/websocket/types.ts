export type WebSocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected';

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export type WebSocketEventListener = (payload: any) => void;
