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
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-900">
      {/* Sidebar - Conversation List */}
      <div 
        className={`${
          mobileMenuOpen ? "fixed inset-0 z-50 w-80" : "hidden md:flex"
        } w-80 border-r border-gray-200 dark:border-gray-800 h-full flex flex-col bg-white dark:bg-zinc-900`}
      >
        {/* Header with logo and menu */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 512 512" className="w-8 h-8 text-primary" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
            </svg>
            <h1 className="text-xl font-semibold">Signal</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="flex-1 flex flex-col h-full relative">
        {activeConversation ? (
          <Conversation 
            conversation={activeConversation}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            isWebSocketConnected={isConnected}
            currentUser={user}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <svg viewBox="0 0 512 512" className="w-16 h-16 text-primary mb-4" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
            </svg>
            <h2 className="text-2xl font-bold mb-2">Welcome to Signal</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Select a conversation to start messaging or add a new contact to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
