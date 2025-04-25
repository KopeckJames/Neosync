import { useState, useEffect } from "react";
import { ContactList } from "@/components/chat/contact-list";
import { Conversation } from "@/components/chat/conversation";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/lib/use-websocket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ui/theme-provider";
import { ConversationWithLastMessage, MessageWithUser } from "@shared/schema";

export function ChatLayout() {
  const { user, logoutMutation } = useAuth();
  const { setTheme, theme } = useTheme();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<ConversationWithLastMessage | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch conversations
  const {
    data: conversations,
    isLoading: conversationsLoading,
  } = useQuery<ConversationWithLastMessage[]>({
    queryKey: ['/api/conversations'],
  });

  // Handle WebSocket messages
  const { isConnected } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'new_message':
          // Add the new message to the conversation
          const newMessage = message.message as MessageWithUser;
          
          // Update the messages in the active conversation if needed
          if (activeConversation && newMessage.conversationId === activeConversation.id) {
            queryClient.setQueryData(
              [`/api/conversations/${activeConversation.id}/messages`], 
              (oldMessages: MessageWithUser[] = []) => [...oldMessages, newMessage]
            );
          }
          
          // Update conversations list to show latest message
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          break;
          
        case 'message_deleted':
          // Handle message deletion
          if (activeConversation && message.conversationId === activeConversation.id) {
            queryClient.setQueryData(
              [`/api/conversations/${activeConversation.id}/messages`],
              (oldMessages: MessageWithUser[] = []) => {
                return oldMessages.map(msg => {
                  if (msg.id === message.messageId) {
                    // Mark message as deleted and clear content
                    return { 
                      ...msg, 
                      isDeleted: true, 
                      content: null 
                    };
                  }
                  return msg;
                });
              }
            );
            
            // Update conversations list to reflect changes
            queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          }
          break;
          
        case 'message_edited':
          // Handle message editing
          const editedMessage = message.message as MessageWithUser;
          
          if (activeConversation && editedMessage.conversationId === activeConversation.id) {
            queryClient.setQueryData(
              [`/api/conversations/${activeConversation.id}/messages`],
              (oldMessages: MessageWithUser[] = []) => {
                return oldMessages.map(msg => {
                  if (msg.id === editedMessage.id) {
                    // Replace with edited message
                    return editedMessage;
                  }
                  return msg;
                });
              }
            );
            
            // Update conversations list to reflect changes
            queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          }
          break;
          
        case 'add_reaction':
        case 'message_reaction':
          // Handle reaction added
          if (activeConversation && message.messageId) {
            // Invalidate messages to refresh reactions for the specific conversation
            queryClient.invalidateQueries({ 
              queryKey: [`/api/conversations/${activeConversation.id}/messages`] 
            });
          }
          break;
          
        case 'message_reaction_removed':
          // Handle reaction removed
          if (activeConversation && message.messageId) {
            // Invalidate messages to refresh reactions for the specific conversation
            queryClient.invalidateQueries({ 
              queryKey: [`/api/conversations/${activeConversation.id}/messages`] 
            });
          }
          break;
          
        case 'messages_read':
          // Update read status of messages
          if (activeConversation && message.conversationId === activeConversation.id) {
            queryClient.setQueryData(
              [`/api/conversations/${activeConversation.id}/messages`],
              (oldMessages: MessageWithUser[] = []) => {
                return oldMessages.map(msg => {
                  if (msg.senderId === user?.id && msg.receiverId === message.readBy && !msg.isRead) {
                    return { ...msg, isRead: true };
                  }
                  return msg;
                });
              }
            );
          }
          break;
          
        case 'status_update':
          // Update user status in contacts or active conversation
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          break;
      }
    }
  });

  // Set first conversation as active on initial load
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    }
  }, [conversations, activeConversation]);

  const handleSelectConversation = (conversation: ConversationWithLastMessage) => {
    setActiveConversation(conversation);
    setMobileMenuOpen(false);
    
    // Mark messages as read
    queryClient.invalidateQueries({ 
      queryKey: [`/api/conversations/${conversation.id}/messages`] 
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Conversation List */}
      <div 
        className={`${
          mobileMenuOpen ? "fixed inset-0 z-50 w-80" : "hidden md:flex"
        } w-80 border-r border-border h-full flex flex-col bg-secondary/30 backdrop-blur-sm transition-all duration-300 ease-in-out shadow-lg`}
      >
        {/* Header with logo and menu */}
        <div className="p-4 border-b border-border flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-3 animate-pulse-slow">
            <div className="relative">
              <svg viewBox="0 0 512 512" className="w-10 h-10 gradient-text animate-float" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
              </svg>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-background animate-pulse"></div>
            </div>
            <h1 className="text-2xl font-bold gradient-text">NeoSync</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-secondary/60 hover:bg-secondary/80 transition-all duration-300"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleLogout}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </Button>
          </div>
        </div>
        
        {/* Contacts and conversations */}
        {conversationsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/20 animate-pulse"></div>
                <div className="w-12 h-12 rounded-full bg-primary/40 animate-pulse absolute top-0 scale-75"></div>
                <div className="w-12 h-12 rounded-full bg-primary/60 animate-pulse absolute top-0 scale-50"></div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">Loading conversations...</p>
            </div>
          </div>
        ) : (
          <ContactList
            conversations={conversations || []}
            activeConversation={activeConversation}
            onSelectConversation={handleSelectConversation}
            currentUser={user}
          />
        )}
      </div>
      
      {/* Main Content - Chat */}
      <div className="flex-1 flex flex-col h-full relative bg-card/30 backdrop-blur-sm">
        {activeConversation ? (
          <Conversation 
            conversation={activeConversation}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            isWebSocketConnected={isConnected}
            currentUser={user}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-10">
              <svg viewBox="0 0 512 512" className="w-24 h-24 gradient-text animate-float" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
              </svg>
              
              {/* Animated particles */}
              <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-primary animate-float" style={{ animationDelay: '0.2s', opacity: 0.6 }}></div>
              <div className="absolute top-1/4 left-3/4 w-3 h-3 rounded-full bg-accent animate-float" style={{ animationDelay: '0.5s', opacity: 0.7 }}></div>
              <div className="absolute bottom-1/4 right-3/4 w-2 h-2 rounded-full bg-primary animate-float" style={{ animationDelay: '0.8s', opacity: 0.5 }}></div>
            </div>
            
            <div className="max-w-md mb-10 space-y-4 slide-up">
              <h2 className="text-4xl font-bold gradient-text">Welcome to NeoSync</h2>
              <div className="relative py-2 px-4 rounded-lg gradient-border bg-card/50 backdrop-blur-sm">
                <p className="text-foreground text-lg">
                  Begin your quantum-secure communications. Select a conversation or add a contact to get started.
                </p>
              </div>
              
              <div className="flex flex-col gap-2 mt-8">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">End-to-End Encrypted</h3>
                    <p className="text-sm text-muted-foreground">Your messages are secured with quantum-resistant encryption</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-.5-1-1-1.5-1-2.5a2.5 2.5 0 0 1 5 0c0 1.38-.5 2-1 3-.5 1-1 1.5-1 2.5a2.5 2.5 0 0 0 2.5 2.5"></path>
                      <circle cx="12" cy="16" r="1"></circle>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Secure Media Sharing</h3>
                    <p className="text-sm text-muted-foreground">Share files, images, and media with confidence</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
