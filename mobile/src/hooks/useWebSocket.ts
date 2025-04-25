import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  onMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<string[]>([]);

  const connect = useCallback(async () => {
    // Close previous connection if exists
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }

    // Get authentication token
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      console.error('No authentication token found');
      return;
    }

    try {
      // Create WebSocket connection with auth token
      const wsUrlWithAuth = `${WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrlWithAuth);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsReconnecting(false);
        
        // Send any queued messages
        if (messageQueueRef.current.length > 0) {
          messageQueueRef.current.forEach((message) => {
            ws.send(message);
          });
          messageQueueRef.current = [];
        }
        
        if (onOpen) onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const parsedMessage = JSON.parse(event.data);
          if (onMessage) onMessage(parsedMessage);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Try to reconnect unless this was a deliberate close
        if (!event.wasClean) {
          setIsReconnecting(true);
          scheduleReconnect();
        }
        
        if (onClose) onClose();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };

      webSocketRef.current = ws;
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      setIsReconnecting(true);
      scheduleReconnect();
    }
  }, [onMessage, onOpen, onClose, onError]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      connect();
    }, 3000); // Reconnect after 3 seconds
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (webSocketRef.current) {
      webSocketRef.current.close(1000, 'User initiated disconnect');
      webSocketRef.current = null;
      setIsConnected(false);
      setIsReconnecting(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const messageString = JSON.stringify(message);
    
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(messageString);
    } else {
      // Queue message to be sent when connection is established
      messageQueueRef.current.push(messageString);
      
      // If not connecting or reconnecting, try to connect
      if (!isConnected && !isReconnecting) {
        connect();
      }
    }
  }, [isConnected, isReconnecting, connect]);

  // Connect on mount and disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isReconnecting,
    sendMessage,
    disconnect,
    reconnect: connect
  };
}