import { useState } from "react";
import { MessageReaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/lib/use-websocket";

// Common emoji reactions to offer
const commonReactions = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🙏", "🔥"];

interface MessageReactionProps {
  messageId: number;
  conversationId: number;
  reactions?: (MessageReaction & { user: { id: number; displayName: string; avatarColor?: string | null } })[];
  currentUserId: number;
}

export function MessageReactions({
  messageId,
  conversationId,
  reactions = [],
  currentUserId
}: MessageReactionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  
  // Group reactions by emoji for display and counting
  const groupedReactions = reactions.reduce<
    Record<string, { count: number; users: string[]; hasReacted: boolean }>
  >((acc, reaction) => {
    if (!acc[reaction.reaction]) {
      acc[reaction.reaction] = {
        count: 0,
        users: [],
        hasReacted: false
      };
    }
    
    acc[reaction.reaction].count += 1;
    acc[reaction.reaction].users.push(reaction.user.displayName);
    
    if (reaction.userId === currentUserId) {
      acc[reaction.reaction].hasReacted = true;
    }
    
    return acc;
  }, {});
  
  // Use websocket for real-time updates
  const { sendMessage } = useWebSocket({
    onMessage: (message) => {
      // Reactions will be handled by the parent Conversation component
      // It will refresh the messages list when it gets a reaction update
    }
  });
  
  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async (reaction: string) => {
      const res = await apiRequest("POST", `/api/messages/${messageId}/reactions`, { reaction });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch conversation messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add reaction",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Remove reaction mutation
  const removeReactionMutation = useMutation({
    mutationFn: async (reaction: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`);
    },
    onSuccess: () => {
      // Invalidate and refetch conversation messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove reaction",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle reaction click - add or remove reaction
  const handleReactionClick = (reaction: string) => {
    if (groupedReactions[reaction]?.hasReacted) {
      // Remove reaction
      removeReactionMutation.mutate(reaction);
      // Also send WebSocket message for real-time updates
      sendMessage({
        type: "message_reaction_removed",
        conversationId,
        messageId,
        reaction
      });
    } else {
      // Add reaction
      addReactionMutation.mutate(reaction);
      // Also send WebSocket message for real-time updates
      sendMessage({
        type: "add_reaction",
        messageId,
        reaction
      });
    }
    
    // Close emoji picker if open
    if (isEmojiPickerOpen) {
      setIsEmojiPickerOpen(false);
    }
  };
  
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {/* Existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, { count, users, hasReacted }]) => (
        <TooltipProvider key={emoji} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={hasReacted ? "default" : "ghost"}
                className={`h-6 px-2 text-xs ${hasReacted ? "bg-primary/10 hover:bg-primary/20" : ""}`}
                onClick={() => handleReactionClick(emoji)}
              >
                <span className="mr-1">{emoji}</span>
                <span>{count}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{users.join(", ")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      
      {/* Add reaction button */}
      <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full">
            <SmilePlus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-2" align="start">
          <div className="flex flex-wrap gap-1">
            {commonReactions.map((emoji) => (
              <Button
                key={emoji}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => handleReactionClick(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}