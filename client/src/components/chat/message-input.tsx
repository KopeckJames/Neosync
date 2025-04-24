import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Smile, Camera, Send, Paperclip } from "lucide-react";
import { useWebSocket } from "@/lib/use-websocket";
import { FileUploader } from "./file-uploader";
import { MessageWithUser } from "@shared/schema";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isSending: boolean;
  conversationId?: number;
  receiverId?: number;
  onFileUploaded?: (message: MessageWithUser) => void;
}

export function MessageInput({ 
  onSendMessage, 
  isSending, 
  conversationId, 
  receiverId,
  onFileUploaded
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { sendMessage } = useWebSocket();

  // Send typing indicator when user types
  useEffect(() => {
    if (!conversationId || !receiverId) return;

    if (message && !isTyping) {
      // Start typing
      setIsTyping(true);
      sendMessage({
        type: 'typing',
        conversationId,
        receiverId
      });
    }

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set a new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        sendMessage({
          type: 'typing_stop',
          conversationId,
          receiverId
        });
      }
    }, 2000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, isTyping, conversationId, receiverId, sendMessage]);

  // When sending a message, also stop the typing indicator
  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isSending) {
      // Send stop typing indicator
      if (isTyping && conversationId && receiverId) {
        setIsTyping(false);
        sendMessage({
          type: 'typing_stop',
          conversationId,
          receiverId
        });
      }
      
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
        <FileUploader 
          conversationId={conversationId}
          receiverId={receiverId}
          onFileUploaded={(response) => {
            if (onFileUploaded) {
              onFileUploaded(response);
            }
          }}
          disabled={isSending}
        />
        
        <div className="flex-1 relative">
          <Textarea
            placeholder="Message"
            className="resize-none min-h-[44px] max-h-32 pr-10 py-3 rounded-full bg-secondary"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 bottom-1 rounded-full h-8 w-8"
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        
        <Button 
          size="icon" 
          className="rounded-full h-11 w-11 flex-shrink-0"
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
        >
          {isSending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
