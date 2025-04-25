import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

type UseWebSocketOptions = {
  onMessage?: (message: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
};

export function useWebSocket({
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  autoReconnect = true
}: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup WebSocket connection
  const connect = useCallback(() => {
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Determine protocol (ws or wss) based on current page protocol
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Create new WebSocket connection
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    // Connection opened
    socket.addEventListener("open", (event) => {
      setIsConnected(true);
      setReconnectAttempt(0);
      
      if (onOpen) {
        onOpen();
      }
    });

    // Listen for messages
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    // Connection closed
    socket.addEventListener("close", (event) => {
      setIsConnected(false);
      
      if (onClose) {
        onClose();
      }
      
      // Attempt to reconnect if enabled
      if (autoReconnect && reconnectAttempt < maxReconnectAttempts) {
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt((prev) => prev + 1);
          connect();
        }, reconnectInterval);
      } else if (reconnectAttempt >= maxReconnectAttempts) {
        toast({
          title: "Connection Lost",
          description: "Failed to reconnect to the server. Please refresh the page.",
          variant: "destructive"
        });
      }
    });

    // Connection error
    socket.addEventListener("error", (event) => {
      if (onError) {
        onError(event);
      }
      
      console.error("WebSocket error:", event);
    });
  }, [
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval,
    reconnectAttempt,
    maxReconnectAttempts,
    autoReconnect,
    toast
  ]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    
    // Queue messages when offline (could be enhanced with local storage queue)
    console.warn("WebSocket not connected. Message not sent:", message);
    return false;
  }, []);

  // Connect when component mounts
  useEffect(() => {
    connect();
    
    // Cleanup when component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    reconnect: connect,
    reconnectAttempt
  };
}