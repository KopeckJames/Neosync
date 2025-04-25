import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Smile, Camera, Send, Paperclip } from "lucide-react";
import { useWebSocket } from "@/lib/use-websocket";
import { FileUploader } from "./file-uploader";
import { MessageWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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
  const [isCapturingImage, setIsCapturingImage] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage } = useWebSocket();
  const { toast } = useToast();

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
  
  const handleCameraClick = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };
  
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file || !receiverId) {
      return;
    }
    
    try {
      setIsCapturingImage(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('receiverId', receiverId.toString());
      
      if (conversationId) {
        formData.append('conversationId', conversationId.toString());
      }
      
      // Upload the image
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Notify parent about the uploaded file
      if (onFileUploaded) {
        onFileUploaded(result);
      }
      
      toast({
        title: 'Image uploaded',
        description: 'Your image has been sent'
      });
      
      // Reset the file input
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsCapturingImage(false);
    }
  };

  return (
    <div className="p-4 border-t border-border backdrop-blur-sm relative">
      {/* Decorative elements */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-16 h-1.5 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20"></div>
      
      <div className="flex items-end gap-3 relative z-10">
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full flex-shrink-0 bg-secondary/60 hover:bg-secondary/80 shadow-sm backdrop-blur-sm border-secondary/50 transition-all duration-300 hover:scale-105"
        >
          <Smile className="h-5 w-5 text-accent" />
        </Button>
        
        <div className="rounded-full bg-gradient-to-r from-primary/10 to-accent/10 p-0.5 backdrop-blur-sm transition-all duration-300 hover:shadow-md">
          <FileUploader 
            conversationId={conversationId}
            receiverId={receiverId}
            onFileUploaded={(response) => {
              if (onFileUploaded) {
                onFileUploaded(response);
              }
            }}
            disabled={isSending || isCapturingImage}
          />
        </div>
        
        {/* Hidden camera input element */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={cameraInputRef}
          onChange={handleCameraCapture}
          disabled={isSending || isCapturingImage}
        />
        
        <div className="flex-1 relative">
          <div className="absolute inset-0 rounded-full bg-secondary/30 backdrop-blur-sm shadow-inner z-0"></div>
          <Textarea
            placeholder="Type a quantum-secure message..."
            className="resize-none min-h-[48px] max-h-32 pr-12 py-3 rounded-full bg-transparent border-secondary/50 relative z-10 focus-visible:ring-primary/50 placeholder:text-muted-foreground/70"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 bottom-1.5 rounded-full h-9 w-9 bg-secondary/60 hover:bg-secondary/80 z-10 transition-all duration-300"
            onClick={handleCameraClick}
            disabled={isSending || isCapturingImage}
          >
            {isCapturingImage ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Camera className="h-5 w-5 text-accent" />
            )}
          </Button>
        </div>
        
        <Button 
          size="icon" 
          className="rounded-full h-12 w-12 flex-shrink-0 bg-gradient-to-br from-primary to-accent text-white shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-70"
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
      
      {/* Hint text */}
      <div className="text-xs text-center text-muted-foreground/60 mt-2">
        End-to-end encrypted • Quantum-secure
      </div>
    </div>
  );
}
