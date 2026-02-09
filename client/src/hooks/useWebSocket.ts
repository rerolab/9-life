import { useCallback, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../types/protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface UseWebSocketReturn {
  status: ConnectionStatus;
  connect: (url: string) => void;
  disconnect: () => void;
  sendMessage: (msg: ClientMessage) => void;
  onMessage: (cb: (msg: ServerMessage) => void) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef<((msg: ServerMessage) => void) | null>(null);

  const connect = useCallback((url: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => setStatus("connected");

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus("disconnected");
      wsRef.current = null;
    };

    ws.onmessage = (ev) => {
      try {
        const msg: ServerMessage = JSON.parse(ev.data);
        callbackRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const onMessage = useCallback((cb: (msg: ServerMessage) => void) => {
    callbackRef.current = cb;
  }, []);

  return { status, connect, disconnect, sendMessage, onMessage };
}
