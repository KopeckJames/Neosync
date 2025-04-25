import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Copy, 
  Pencil, 
  Trash2, 
  Reply, 
  Forward, 
  MoreVertical, 
  Link, 
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/lib/use-websocket";
import { ConversationWithLastMessage } from "@shared/schema";

interface MessageActionsProps {
  messageId: number;
  conversationId: number;
  isCurrentUser: boolean;
  isDeleted: boolean;
  onEdit: () => void;
  onReply: () => void;
  conversations: ConversationWithLastMessage[];
}

export function MessageActions({
  messageId,
  conversationId,
  isCurrentUser,
  isDeleted,
  onEdit,
  onReply,
  conversations
}: MessageActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  
  // Use websocket for real-time updates
  const { sendMessage } = useWebSocket({});
  
  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      // Also send WebSocket message for real-time updates
      sendMessage({
        type: "delete_message",
        messageId
      });
      
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      
      // Close dialog
      setIsDeleteDialogOpen(false);
      
      toast({
        title: "Message Deleted",
        description: "Your message has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Message",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Forward message mutation
  const forwardMessageMutation = useMutation({
    mutationFn: async (targetConversationId: number) => {
      const res = await apiRequest("POST", `/api/messages/${messageId}/forward`, {
        conversationId: targetConversationId
      });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${selectedConversationId}/messages`] });
      
      // Close dialog
      setIsForwardDialogOpen(false);
      setSelectedConversationId(null);
      
      toast({
        title: "Message Forwarded",
        description: "Your message has been forwarded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Forward Message",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard",
        description: "Message text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to Copy",
        description: "Could not copy text to clipboard",
        variant: "destructive"
      });
    }
  };
  
  const handleDelete = () => {
    deleteMessageMutation.mutate();
  };
  
  const handleForward = (targetConversationId: number) => {
    setSelectedConversationId(targetConversationId);
    forwardMessageMutation.mutate(targetConversationId);
  };
  
  // Filter out current conversation from forward options
  const forwardConversations = conversations.filter(
    conv => conv.id !== conversationId
  );
  
  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  tabIndex={-1} 
                  data-state="closed"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Message actions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <DropdownMenuContent align="end">
          {!isDeleted && (
            <DropdownMenuItem onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
          )}
          
          {!isDeleted && (
            <DropdownMenuItem onClick={() => setIsForwardDialogOpen(true)}>
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </DropdownMenuItem>
          )}
          
          {!isDeleted && (
            <DropdownMenuItem onClick={() => handleCopyText("Message text goes here")}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Text
            </DropdownMenuItem>
          )}
          
          {isCurrentUser && !isDeleted && (
            <>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Message
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Message
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center p-4 mt-2 bg-gray-100 dark:bg-gray-900 rounded-md">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteMessageMutation.isPending}
            >
              Cancel
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMessageMutation.isPending}
            >
              {deleteMessageMutation.isPending ? "Deleting..." : "Delete Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Forward dialog */}
      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>
              Select a conversation to forward this message to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[250px] overflow-y-auto space-y-2 p-1">
            {forwardConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No other conversations available
              </div>
            ) : (
              forwardConversations.map((conv) => (
                <Button
                  key={conv.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleForward(conv.id)}
                  disabled={forwardMessageMutation.isPending}
                >
                  <Forward className="h-4 w-4 mr-2" />
                  {conv.isGroup ? conv.groupName : conv.contact?.displayName || "Unknown"}
                </Button>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsForwardDialogOpen(false)}
              disabled={forwardMessageMutation.isPending}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}