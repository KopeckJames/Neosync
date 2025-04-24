import { useState, useEffect } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageWithUser } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Lock } from "lucide-react";
import { AttachmentPreview } from "./attachment-preview";

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
  
  // For encrypted messages
  const [decryptedContent, setDecryptedContent] = useState<string>(
    message.isEncrypted ? "Decrypting..." : (message.content || "")
  );
  const [decryptError, setDecryptError] = useState<boolean>(false);
  
  // Decrypt the message if needed
  useEffect(() => {
    if (message.isEncrypted) {
      const decryptMessage = async () => {
        try {
          // Import the encryption utilities
          const { decryptMessage, storeContactKey } = await import('@/lib/encryption');
          
          // Need to get the sender's public key
          const senderId = isCurrentUser ? contact.id : message.sender.id;
          
          // Fetch sender's public key if needed
          const response = await fetch(`/api/keys/${senderId}`);
          if (!response.ok) {
            throw new Error('Failed to get encryption key');
          }
          
          const { publicKey } = await response.json();
          
          // Store the sender's public key for decryption
          await storeContactKey(senderId, publicKey);
          
          // Decrypt the message
          if (message.nonce) {
            const decrypted = await decryptMessage(senderId, {
              content: message.content || "",
              nonce: message.nonce || ""
            });
            setDecryptedContent(decrypted);
          } else {
            // If no nonce, we can't decrypt
            setDecryptError(true);
            setDecryptedContent("Message cannot be decrypted");
          }
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          setDecryptError(true);
          setDecryptedContent("Message cannot be decrypted");
        }
      };
      
      decryptMessage();
    } else {
      // Not encrypted, just show the content
      setDecryptedContent(message.content || "");
    }
  }, [message, isCurrentUser, contact.id]);
  
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
                } ${decryptError ? "bg-destructive/20 border border-destructive/50" : ""}`}
                onClick={() => setShowDetails(!showDetails)}
              >
                {/* Show the message content if it exists */}
                {decryptedContent && (
                  <p className="whitespace-pre-wrap break-words mb-2">{decryptedContent}</p>
                )}
                
                {/* Show attachments if any */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2">
                    {message.attachments.map((attachment) => {
                      // Transform attachment to AttachmentWithThumbnail if needed
                      const attachmentWithUrl: AttachmentWithThumbnail = {
                        ...attachment,
                        downloadUrl: attachment.filePath,
                        thumbnailUrl: attachment.thumbnailPath || undefined
                      };
                      
                      return (
                        <AttachmentPreview 
                          key={attachment.id} 
                          attachment={attachmentWithUrl}
                          messageType={message.messageType || 'text'}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side={isCurrentUser ? "left" : "right"}>
              {format(timestamp, "MMM d, yyyy 'at' h:mm a")}
              {message.isEncrypted && " • Encrypted"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Time and read status (for sent messages) */}
        {isCurrentUser && (
          <div className="flex items-center gap-1 mt-1 mr-2">
            <span className="text-xs text-muted-foreground">
              {format(timestamp, "h:mm a")}
            </span>
            {message.isEncrypted && (
              <Lock className="h-3 w-3 text-primary" />
            )}
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
          <div className="flex items-center gap-1 mt-1 ml-2">
            <span className="text-xs text-muted-foreground">
              {format(timestamp, "h:mm a")}
            </span>
            {message.isEncrypted && (
              <Lock className="h-3 w-3 text-primary" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
