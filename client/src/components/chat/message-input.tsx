import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Smile, Paperclip, Camera, Send } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isSending: boolean;
}

export function MessageInput({ onSendMessage, isSending }: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isSending) {
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>
        
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
