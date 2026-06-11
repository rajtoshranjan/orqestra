import { WebSocketConnectionState, WebSocketEventListener } from './types';

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private connectionState: WebSocketConnectionState = 'disconnected';
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: any = null;
  private maxReconnectInterval = 30000;
  private listeners: Map<string, Set<WebSocketEventListener>> = new Map();
  private stateListeners: Set<(state: WebSocketConnectionState) => void> =
    new Set();

  // Track active subscriptions to resubscribe on reconnect
  private activeSubscriptions: Set<string> = new Set();

  constructor(url: string) {
    this.url = url;
  }

  public connect(token: string): void {
    if (this.connectionState !== 'disconnected') {
      if (this.token !== token) {
        this.disconnect();
      } else {
        return;
      }
    }

    this.token = token;
    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.token = null;
    this.activeSubscriptions.clear();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  public subscribe(group: 'org' | 'project' | 'deployment', id: string): void {
    const subKey = JSON.stringify({ group, id });
    this.activeSubscriptions.add(subKey);

    if (this.connectionState === 'connected') {
      this.sendJson({
        action: 'subscribe',
        group,
        id,
      });
    }
  }

  public unsubscribe(
    group: 'org' | 'project' | 'deployment',
    id: string,
  ): void {
    const subKey = JSON.stringify({ group, id });
    this.activeSubscriptions.delete(subKey);

    if (this.connectionState === 'connected') {
      this.sendJson({
        action: 'unsubscribe',
        group,
        id,
      });
    }
  }

  public addEventListener(
    event: string,
    listener: WebSocketEventListener,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => this.removeEventListener(event, listener);
  }

  public removeEventListener(
    event: string,
    listener: WebSocketEventListener,
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public addStateListener(
    listener: (state: WebSocketConnectionState) => void,
  ): () => void {
    this.stateListeners.add(listener);
    // Immediately call with current state
    listener(this.connectionState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public getState(): WebSocketConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        // Ignored
      }
    });
  }

  private handleOpen(): void {
    if (!this.token) {
      this.disconnect();
      return;
    }

    // Authenticate immediately as the first message
    this.sendJson({
      action: 'authenticate',
      token: this.token,
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const { type, payload } = data;

      if (type === 'authenticated') {
        this.setConnectionState('connected');
        this.reconnectAttempts = 0;
        this.resubscribeAll();
        return;
      }

      if (type === 'error') {
        return;
      }

      // Dispatch event to registered listeners
      if (type) {
        const eventListeners = this.listeners.get(type);
        if (eventListeners) {
          eventListeners.forEach((listener) => {
            try {
              listener(payload);
            } catch (e) {
              // Ignored
            }
          });
        }
      }
    } catch (error) {
      // Ignored
    }
  }

  private handleClose(event: CloseEvent): void {
    this.setConnectionState('disconnected');

    // Code 4001 indicates an explicit authentication rejection, do not reconnect
    if (event.code === 4001) {
      this.token = null;
      return;
    }

    // Only reconnect if we still have a token (i.e. user is still logged in)
    if (this.token) {
      this.scheduleReconnect();
    }
  }

  private handleError(_error: Event): void {
    // Note: handleClose is always called after handleError, so we do not trigger reconnect here
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      return;
    }

    // Exponential backoff with jitter
    const backoffDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectInterval,
    );
    const jitter = Math.random() * 1000;
    const delay = backoffDelay + jitter;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.reconnectAttempts++;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private resubscribeAll(): void {
    if (this.activeSubscriptions.size === 0) return;

    this.activeSubscriptions.forEach((subKey) => {
      try {
        const { group, id } = JSON.parse(subKey);
        this.sendJson({
          action: 'subscribe',
          group,
          id,
        });
      } catch (e) {
        // Ignored
      }
    });
  }

  private sendJson(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
