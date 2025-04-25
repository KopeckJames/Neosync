import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/lib/use-websocket";

interface MessageEditProps {
  messageId: number;
  conversationId: number;
  originalContent: string;
  isEncrypted: boolean;
  encryptionType?: string;
  onCancel: () => void;
}

export function MessageEdit({
  messageId,
  conversationId,
  originalContent,
  isEncrypted,
  encryptionType = "sodium",
  onCancel
}: MessageEditProps) {
  const [content, setContent] = useState(originalContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use websocket for real-time updates
  const { sendMessage } = useWebSocket({});
  
  // Focus the textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end of text
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);
  
  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async () => {
      let encryptedData = {};
      
      if (isEncrypted) {
        try {
          // Import encryption utilities
          const { encryptMessage } = await import('@/lib/encryption');
          
          // Get current user's encryption key
          const encryptedResult = await encryptMessage(-1, content);
          
          encryptedData = {
            isEncrypted: true,
            encryptionType,
            nonce: encryptedResult.nonce
          };
        } catch (error) {
          console.error('Encryption error:', error);
          toast({
            title: "Encryption Failed",
            description: "Could not encrypt your message. Sending as plaintext.",
            variant: "destructive"
          });
        }
      }
      
      const res = await apiRequest("PUT", `/api/messages/${messageId}`, {
        content,
        ...encryptedData
      });
      
      return await res.json();
    },
    onSuccess: () => {
      // Also send WebSocket message for real-time updates
      sendMessage({
        type: "edit_message",
        messageId,
        content,
        isEncrypted
      });
      
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      
      // Close edit mode
      onCancel();
      
      toast({
        title: "Message Updated",
        description: "Your message has been edited successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Edit Message",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({
        title: "Empty Message",
        description: "Message content cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    editMessageMutation.mutate();
  };
  
  // Reset content and close edit mode
  const handleCancel = () => {
    setContent(originalContent);
    onCancel();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[80px] focus-visible:ring-primary/50"
        placeholder="Edit your message..."
      />
      
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={editMessageMutation.isPending}
        >
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        
        <Button
          type="submit"
          size="sm"
          disabled={
            content.trim() === originalContent.trim() ||
            editMessageMutation.isPending ||
            !content.trim()
          }
        >
          <Check className="h-4 w-4 mr-1" /> Save Changes
        </Button>
      </div>
    </form>
  );
}