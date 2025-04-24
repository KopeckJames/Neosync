import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Search, Plus, Check } from "lucide-react";
import { ConversationWithLastMessage } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContactListProps {
  conversations: ConversationWithLastMessage[];
  activeConversation: ConversationWithLastMessage | null;
  onSelectConversation: (conversation: ConversationWithLastMessage) => void;
  currentUser: { id: number; displayName: string };
}

export function ContactList({
  conversations,
  activeConversation,
  onSelectConversation,
  currentUser
}: ContactListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users to add as contacts
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: addContactDialogOpen,
  });

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("POST", "/api/contacts", { contactId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setAddContactDialogOpen(false);
      toast({
        title: "Contact added",
        description: "You can now start a conversation",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding contact",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filter conversations by search term
  const filteredConversations = conversations.filter(conversation => 
    conversation.contact.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations"
              className="pl-9 bg-secondary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={addContactDialogOpen} onOpenChange={setAddContactDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add new contact</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <Input
                  placeholder="Search users..."
                  className="mb-4"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <ScrollArea className="h-[300px]">
                  {users
                    .filter(user => 
                      user.id !== currentUser.id && 
                      user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 hover:bg-secondary rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            user={user} 
                            size="md" 
                          />
                          <div>
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => addContactMutation.mutate(user.id)}
                          disabled={addContactMutation.isPending}
                        >
                          {addContactMutation.isPending 
                            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            : <Check className="h-4 w-4 mr-1" />
                          }
                          Add
                        </Button>
                      </div>
                    ))
                  }
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations found
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const isActive = activeConversation?.id === conversation.id;
            const { contact, lastMessage, unreadCount } = conversation;
            
            return (
              <div
                key={conversation.id}
                className={`p-3 flex items-center gap-3 cursor-pointer ${
                  isActive 
                    ? "bg-primary/10 dark:bg-primary/20" 
                    : "hover:bg-secondary"
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="relative">
                  <UserAvatar 
                    user={contact} 
                    size="lg"
                    status={contact.isOnline ? "online" : "offline"}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold truncate">{contact.displayName}</h3>
                    {lastMessage && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground truncate">
                      {lastMessage?.content || "No messages yet"}
                    </p>
                    {unreadCount > 0 && (
                      <span className="w-5 h-5 bg-primary rounded-full text-white text-xs flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}

function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  // For today's date, show time only
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Otherwise show relative time (today, yesterday, etc)
  return formatDistanceToNow(date, { addSuffix: true });
}
