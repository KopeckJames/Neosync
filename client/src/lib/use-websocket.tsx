import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

type UseWebSocketOptions = {
  onMessage?: (message: WebSocketMessage) => void;
};

export function useWebSocket({ onMessage }: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  const connect = useCallback(() => {
    if (!user || socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      // Authenticate with the WebSocket server
      socket.send(JSON.stringify({
        type: 'authenticate',
        userId: user.id
      }));
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Try to reconnect after a delay
      setTimeout(() => {
        if (user) connect();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      socket.close();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [user, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return { isConnected, sendMessage };
}
