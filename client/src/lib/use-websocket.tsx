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
    // Only attempt to connect if we have a logged-in user
    if (!user?.id || socketRef.current?.readyState === WebSocket.OPEN) return;

    // Close any existing connection first
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        // Authenticate with the WebSocket server
        socket.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id
        }));
      };
      
      socket.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        // Try to reconnect after a delay
        setTimeout(() => {
          if (user) connect();
        }, 3000);
      };

      socket.onerror = (err: Event) => {
        console.error('WebSocket error:', err);
        socket.close();
      };

      socket.onmessage = (evt: MessageEvent) => {
        try {
          const message = JSON.parse(evt.data);
          if (onMessage) {
            onMessage(message);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
    }

    // No need to return a cleanup function here
    // It's handled by the useEffect
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
