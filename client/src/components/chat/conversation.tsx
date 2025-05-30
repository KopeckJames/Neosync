import { useRef, useEffect, useState } from "react";
import { MessageInput } from "@/components/chat/message-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { CallButtons } from "@/components/chat/call-buttons";
import { showIncomingCallToast } from "@/components/chat/incoming-call-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversationWithLastMessage, MessageWithUser, InsertMessage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { formatDistanceToNow } from "date-fns";
import { useWebSocket } from "@/lib/use-websocket";

interface ConversationProps {
  conversation: ConversationWithLastMessage;
  onOpenMobileMenu: () => void;
  isWebSocketConnected: boolean;
  currentUser: { id: number; displayName: string };
}

export function Conversation({
  conversation,
  onOpenMobileMenu,
  isWebSocketConnected,
  currentUser
}: ConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isContactTyping, setIsContactTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { contact } = conversation;
  
  // State for incoming calls
  const [incomingCall, setIncomingCall] = useState<{
    sessionId: string;
    mediaType: 'audio' | 'video' | 'both';
  } | null>(null);
  
  // Use websocket for typing indicators and call signaling
  const { sendMessage } = useWebSocket({
    onMessage: (message) => {
      // Handle typing indicator messages
      if (message.type === 'typing' && 
          message.userId === contact.id && 
          message.conversationId === conversation.id) {
        setIsContactTyping(true);
        
        // Clear any existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set a timeout to clear the typing indicator after 3 seconds of no updates
        typingTimeoutRef.current = setTimeout(() => {
          setIsContactTyping(false);
        }, 3000);
      }
      
      // Handle typing stopped messages
      else if (message.type === 'typing_stop' && 
               message.userId === contact.id && 
               message.conversationId === conversation.id) {
        setIsContactTyping(false);
        
        // Clear timeout if it exists
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
      
      // Handle incoming call request
      else if (message.type === 'call-request' &&
               message.from === contact.id &&
               message.to === currentUser.id) {
        
        setIncomingCall({
          sessionId: message.sessionId,
          mediaType: message.mediaType || 'audio'
        });
        
        // Show incoming call toast
        const { IncomingCallToastHelper } = require('./incoming-call-toast-helper');
        
        // Render the toast
        IncomingCallToastHelper({
          userId: currentUser.id,
          contactId: contact.id,
          contactName: contact.displayName,
          contactAvatar: contact.avatarColor,
          sessionId: message.sessionId,
          mediaType: message.mediaType || 'audio',
          onAccept: () => {
            // Open call dialog with answer mode
            // Call will be answered when dialog opens
            setIncomingCall(null);
          },
          onDecline: () => {
            // Send decline message through websocket
            sendMessage({
              type: 'call-rejected',
              contactId: contact.id,
              sessionId: message.sessionId,
              reason: 'Call declined by user'
            });
            
            setIncomingCall(null);
          }
        });
      }
      
      // Handle call ended
      else if (message.type === 'call-ended' &&
               message.from === contact.id &&
               message.to === currentUser.id) {
        
        setIncomingCall(null);
      }
    }
  });
  
  // Cleanup typing indicator when conversation changes
  useEffect(() => {
    setIsContactTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversation.id]);
  
  // Fetch messages for this conversation
  const { 
    data: messages = [],
    isLoading: messagesLoading
  } = useQuery<MessageWithUser[]>({
    queryKey: [`/api/conversations/${conversation.id}/messages`],
    refetchInterval: isWebSocketConnected ? false : 3000, // Only poll if websocket is not connected
  });

  // Fetch recipient's public key
  const { 
    data: recipientKey,
    isLoading: keyLoading 
  } = useQuery<{ userId: number; publicKey: string }>({
    queryKey: [`/api/keys/${contact.id}`],
    enabled: !!contact.id, // Only fetch when we have a contact
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string }) => {
      // Import the encryption utilities
      const { encryptMessage, storeContactKey } = await import('@/lib/encryption');
      
      // Make sure we have the recipient's public key
      if (!recipientKey) {
        throw new Error("Recipient's encryption key not found");
      }
      
      // Store the contact's public key for encryption
      await storeContactKey(contact.id, recipientKey.publicKey);
      
      // Encrypt the message
      const encryptedData = await encryptMessage(contact.id, messageData.content);
      
      // Prepare the message data to send
      const data: Partial<InsertMessage> = {
        content: encryptedData.content, // Encrypted content
        receiverId: contact.id,
        isEncrypted: true,
        encryptionType: 'sodium',
        nonce: encryptedData.nonce, // Include nonce for decryption
      };
      
      const res = await apiRequest("POST", "/api/messages", data);
      return await res.json();
    },
    onSuccess: (newMessage: MessageWithUser) => {
      // Optimistically update the message list
      queryClient.setQueryData(
        [`/api/conversations/${conversation.id}/messages`], 
        (oldMessages: MessageWithUser[] = []) => [...oldMessages, newMessage]
      );
      
      // Update the conversations list to reflect the latest message
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <>
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full"
            onClick={onOpenMobileMenu}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <UserAvatar 
            user={contact} 
            size="md"
            status={contact.isOnline ? "online" : "offline"} 
          />
          
          <div>
            <h2 className="font-semibold">{contact.displayName}</h2>
            <p className="text-xs text-muted-foreground">
              {contact.isOnline 
                ? "Online" 
                : contact.lastSeen 
                  ? `Last seen ${formatDistanceToNow(new Date(contact.lastSeen), { addSuffix: true })}` 
                  : "Offline"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <CallButtons
            userId={currentUser.id}
            contactId={contact.id}
            contactName={contact.displayName}
            contactAvatar={contact.avatarColor}
            incomingCall={incomingCall}
          />
          <Button variant="ghost" size="icon" className="rounded-full">
            <Info className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </div>
      
      {/* Encryption notice */}
      <div className="bg-primary/10 dark:bg-primary/20 text-xs text-center py-2 border-b border-gray-200 dark:border-gray-800">
        <svg className="inline-block w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Quantum-secure encryption active with {contact.displayName}. Tap for more info.
      </div>
      
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4 space-y-4 overflow-auto">
        {messagesLoading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full mb-4">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 9H16M8 13H14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Start the conversation by sending a message below.
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex justify-center my-4">
                <span className="text-xs bg-secondary text-muted-foreground px-3 py-1 rounded-full">
                  {formatDate(date)}
                </span>
              </div>
              
              {/* Messages for this date */}
              {dateMessages.map((message, index) => {
                const isCurrentUser = message.senderId === currentUser.id;
                const showAvatar = !isCurrentUser && (
                  index === 0 || 
                  dateMessages[index - 1].senderId !== message.senderId
                );

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isCurrentUser={isCurrentUser}
                    showAvatar={showAvatar}
                    contact={contact}
                  />
                );
              })}
            </div>
          ))
        )}
        
        {/* Typing indicator (shown when needed) */}
        {isContactTyping && (
          <TypingIndicator contact={contact} />
        )}
        
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </ScrollArea>
      
      {/* Message Input */}
      <MessageInput
        onSendMessage={(content) => sendMessageMutation.mutate({ content })}
        isSending={sendMessageMutation.isPending}
        conversationId={conversation.id}
        receiverId={contact.id}
        onFileUploaded={(message) => {
          // Update the messages directly in the cache
          queryClient.setQueryData(
            [`/api/conversations/${conversation.id}/messages`], 
            (oldMessages: MessageWithUser[] = []) => [...oldMessages, message]
          );
          
          // Update the conversations list to reflect the latest message
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          
          // Scroll to the new message
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }}
      />
    </>
  );
}

// Group messages by date (YYYY-MM-DD)
function groupMessagesByDate(messages: MessageWithUser[]) {
  return messages.reduce<Record<string, MessageWithUser[]>>((groups, message) => {
    const date = new Date(message.timestamp).toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});
}

// Format date for display
function formatDate(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
