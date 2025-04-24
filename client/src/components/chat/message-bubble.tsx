import { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageWithUser } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: MessageWithUser;
  isCurrentUser: boolean;
  showAvatar: boolean;
  contact: {
    id: number;
    displayName: string;
    avatarColor?: string | null;
  };
}

export function MessageBubble({
  message,
  isCurrentUser,
  showAvatar,
  contact
}: MessageBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);
  const timestamp = new Date(message.timestamp);
  
  return (
    <div
      className={`flex items-end gap-2 max-w-[80%] ${
        isCurrentUser ? "flex-row-reverse ml-auto" : ""
      } my-1`}
    >
      {/* Avatar (for received messages) */}
      {!isCurrentUser && (
        <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? "" : "opacity-0"}`}>
          {showAvatar && <UserAvatar user={contact} size="sm" />}
        </div>
      )}
      
      {/* Message content and status */}
      <div className={isCurrentUser ? "flex flex-col items-end" : ""}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`p-3 rounded-lg ${
                  isCurrentUser
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-secondary rounded-bl-none"
                }`}
                onClick={() => setShowDetails(!showDetails)}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side={isCurrentUser ? "left" : "right"}>
              {format(timestamp, "MMM d, yyyy 'at' h:mm a")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Time and read status (for sent messages) */}
        {isCurrentUser && (
          <div className="flex items-center gap-1 mt-1 mr-2">
            <span className="text-xs text-muted-foreground">
              {format(timestamp, "h:mm a")}
            </span>
            <span className={`text-xs ${message.isRead ? "text-primary" : "text-muted-foreground"}`}>
              {message.isRead ? (
                <>
                  <svg 
                    className="inline-block w-3 h-3" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M4 12L8.5 16.5L20 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 16.5L20 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Read
                </>
              ) : (
                <>
                  <svg 
                    className="inline-block w-3 h-3" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M5 12L9 16L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sent
                </>
              )}
            </span>
          </div>
        )}
        
        {/* Time (for received messages) */}
        {!isCurrentUser && (
          <span className="text-xs text-muted-foreground ml-2 mt-1">
            {format(timestamp, "h:mm a")}
          </span>
        )}
      </div>
    </div>
  );
}
