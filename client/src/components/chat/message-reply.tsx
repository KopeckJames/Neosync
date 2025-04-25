import { MessageWithUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowUpLeft } from "lucide-react";

interface MessageReplyProps {
  replyTo: MessageWithUser;
  isCurrentUser: boolean;
  onScrollToMessage: (messageId: number) => void;
}

export function MessageReply({
  replyTo,
  isCurrentUser,
  onScrollToMessage
}: MessageReplyProps) {
  // Helper function to truncate content if too long
  const truncateContent = (content: string | null, maxLength = 70) => {
    if (!content) return "Empty message";
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };
  
  // Handle click on reply to scroll to original message
  const handleScrollToReply = () => {
    onScrollToMessage(replyTo.id);
  };
  
  // Determine message type for display
  const getReplyPreview = () => {
    if (replyTo.isDeleted) {
      return "This message was deleted";
    }
    
    if (replyTo.messageType === "text" || !replyTo.messageType) {
      return replyTo.content ? truncateContent(replyTo.content) : "Empty message";
    }
    
    // Handle different message types
    switch (replyTo.messageType) {
      case "image":
        return "📷 Image";
      case "video":
        return "🎥 Video";
      case "audio":
        return "🎵 Audio";
      case "file":
        return "📎 File";
      default:
        return replyTo.content ? truncateContent(replyTo.content) : "Message";
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex items-center h-auto py-1 px-2 text-xs rounded mb-1
        ${isCurrentUser ? "justify-end ml-auto" : "justify-start mr-auto"}
        bg-muted/30 hover:bg-muted/50 text-muted-foreground`}
      onClick={handleScrollToReply}
    >
      <ArrowUpLeft className="h-3 w-3 mr-1 flex-shrink-0" />
      <span className="font-medium mr-1 truncate">
        {replyTo.sender.displayName}:
      </span>
      <span className="truncate">{getReplyPreview()}</span>
    </Button>
  );
}

interface MessageForwardProps {
  forwardedFrom: MessageWithUser;
  isCurrentUser: boolean;
}

export function MessageForward({
  forwardedFrom,
  isCurrentUser
}: MessageForwardProps) {
  return (
    <div
      className={`flex items-center py-1 px-2 text-xs rounded mb-1
        ${isCurrentUser ? "justify-end ml-auto" : "justify-start mr-auto"}
        bg-muted/10 italic text-muted-foreground`}
    >
      <span>Forwarded from {forwardedFrom.sender.displayName}</span>
    </div>
  );
}