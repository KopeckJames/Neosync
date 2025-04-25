import { useState, useEffect, useRef } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageWithUser, AttachmentWithThumbnail, ConversationWithLastMessage } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Lock, Check, Clock } from "lucide-react";
import { AttachmentPreview } from "./attachment-preview";
import { MessageReactions } from "./message-reactions";
import { MessageEdit } from "./message-edit";
import { MessageActions } from "./message-actions";
import { MessageReply, MessageForward } from "./message-reply";
import { AnimatedText } from "./animated-text";

interface MessageBubbleProps {
  message: MessageWithUser;
  isCurrentUser: boolean;
  showAvatar: boolean;
  contact: {
    id: number;
    displayName: string;
    avatarColor?: string | null;
  };
  onScrollToMessage?: (messageId: number) => void;
  conversations?: ConversationWithLastMessage[];
  conversationId: number;
  currentUserId: number;
}

export function MessageBubble({
  message,
  isCurrentUser,
  showAvatar,
  contact,
  onScrollToMessage,
  conversations = [],
  conversationId,
  currentUserId
}: MessageBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
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
  
  // Function to scroll to message when requested (e.g., from a reply)
  useEffect(() => {
    if (messageRef.current && message.highlighted) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight animation
      messageRef.current.classList.add('highlight-message');
      // Remove the highlight class after animation completes
      setTimeout(() => {
        if (messageRef.current) {
          messageRef.current.classList.remove('highlight-message');
        }
      }, 2000);
    }
  }, [message.highlighted]);

  return (
    <div
      ref={messageRef}
      className={`flex flex-col gap-1 max-w-[80%] ${
        isCurrentUser ? "ml-auto items-end" : ""
      } my-2 group relative`}
      id={`message-${message.id}`}
    >
      {/* Message Reply reference (if this is a reply to another message) */}
      {message.replyTo && onScrollToMessage && (
        <MessageReply 
          replyTo={message.replyTo} 
          isCurrentUser={isCurrentUser}
          onScrollToMessage={onScrollToMessage}
        />
      )}
      
      {/* Forwarded message indicator */}
      {message.forwardedFrom && (
        <MessageForward 
          forwardedFrom={message.forwardedFrom} 
          isCurrentUser={isCurrentUser}
        />
      )}
      
      <div className={`flex items-end gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar (for received messages) */}
        {!isCurrentUser && (
          <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? "" : "opacity-0"}`}>
            {showAvatar && <UserAvatar user={contact} size="sm" />}
          </div>
        )}
        
        {/* Message content and actions */}
        <div className="relative">
          {/* Message status (for scheduled/delayed messages) */}
          {message.scheduledFor && new Date(message.scheduledFor) > new Date() && (
            <div className="flex items-center text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3 mr-1" />
              <span>Will send at {format(new Date(message.scheduledFor), "MMM d, h:mm a")}</span>
            </div>
          )}
          
          {/* Edited indicator */}
          {message.edits && message.edits.length > 0 && !isEditing && !message.isDeleted && (
            <div className="text-xs text-muted-foreground mb-1">
              <span>(edited)</span>
            </div>
          )}
          
          {/* Message content or edit form */}
          {isEditing ? (
            <MessageEdit
              messageId={message.id}
              conversationId={conversationId}
              originalContent={decryptedContent}
              isEncrypted={message.isEncrypted || false}
              encryptionType={message.encryptionType || undefined}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`p-3 rounded-xl shadow-sm transition-all hover:shadow-md ${
                        isCurrentUser
                          ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-none backdrop-blur-sm"
                          : "bg-secondary/80 rounded-bl-none backdrop-blur-sm border border-secondary/50"
                      } ${message.isDeleted ? "italic opacity-60" : ""} 
                      ${decryptError ? "bg-destructive/20 border border-destructive/50" : ""}
                      slide-up`}
                      style={{ animationDelay: `${Math.random() * 0.3}s` }}
                    >
                      {/* Content for deleted messages */}
                      {message.isDeleted ? (
                        <AnimatedText 
                          text="This message was deleted" 
                          animationType="fade"
                          className="text-muted-foreground italic"
                        />
                      ) : (
                        <>
                          {/* Show the message content if it exists */}
                          {decryptedContent && (
                            <AnimatedText
                              text={decryptedContent}
                              animationType={
                                message.isEncrypted ? "fade" : 
                                message.highlighted ? "scale" : 
                                Math.random() > 0.7 ? "wave" : "typewriter"
                              }
                              speed={message.content && message.content.length > 100 ? "fast" : "normal"}
                            />
                          )}
                          
                          {/* Show attachments if any */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2">
                              {message.attachments.map((attachment) => {
                                // Transform attachment to AttachmentWithThumbnail if needed
                                const attachmentWithUrl = {
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
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side={isCurrentUser ? "left" : "right"}>
                    {format(timestamp, "MMM d, yyyy 'at' h:mm a")}
                    {message.isEncrypted && " • Encrypted"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Message Actions Menu (only visible on hover or for current user's messages) */}
              {!message.isDeleted && (
                <div className={`absolute ${isCurrentUser ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <MessageActions
                    messageId={message.id}
                    conversationId={conversationId}
                    isCurrentUser={isCurrentUser}
                    isDeleted={message.isDeleted || false}
                    messageContent={decryptedContent}
                    onEdit={() => setIsEditing(true)}
                    onReply={() => setIsReplying(true)}
                    conversations={conversations}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Message Reactions */}
          {!message.isDeleted && (
            <MessageReactions
              messageId={message.id}
              conversationId={conversationId}
              reactions={message.reactions || []}
              currentUserId={currentUserId}
            />
          )}
          
          {/* Time and read status (for sent messages) */}
          {isCurrentUser && (
            <div className="flex items-center gap-2 mt-2 text-right">
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground backdrop-blur-sm">
                {format(timestamp, "h:mm a")}
              </span>
              {message.isEncrypted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs backdrop-blur-sm">
                  <Lock className="h-3 w-3" />
                  <span>Encrypted</span>
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs backdrop-blur-sm ${
                message.isRead 
                  ? "bg-success/10 text-success" 
                  : "bg-secondary/40 text-muted-foreground"
              }`}>
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
            <div className="flex items-center gap-2 mt-2 text-left">
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground backdrop-blur-sm">
                {format(timestamp, "h:mm a")}
              </span>
              {message.isEncrypted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs backdrop-blur-sm">
                  <Lock className="h-3 w-3" />
                  <span>Encrypted</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
