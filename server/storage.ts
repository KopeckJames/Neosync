import { 
  users, type User, type InsertUser,
  contacts, type Contact, type InsertContact,
  conversations, type Conversation, type InsertConversation, 
  messages, type Message, type InsertMessage,
  type ConversationWithLastMessage, type MessageWithUser
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, isOnline: boolean): Promise<void>;
  updateLastSeen(id: number): Promise<void>;
  
  // Key methods
  storeUserKey(userId: number, publicKey: string): Promise<void>;
  getUserKey(userId: number): Promise<string | undefined>;
  
  // Contact methods
  addContact(contact: InsertContact): Promise<Contact>;
  getContacts(userId: number): Promise<User[]>;
  
  // Conversation methods
  getOrCreateConversation(user1Id: number, user2Id: number): Promise<Conversation>;
  getConversationById(id: number): Promise<Conversation | undefined>;
  getUserConversations(userId: number): Promise<ConversationWithLastMessage[]>;
  
  // Message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: number): Promise<MessageWithUser[]>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  
  // Session store
  sessionStore: any; // Using 'any' to avoid TypeScript issues with session.SessionStore
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contacts: Map<number, Contact>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private userKeys: Map<number, string>; // Store user public keys
  sessionStore: any; // Using 'any' to avoid TypeScript issues
  
  private userIdCounter: number;
  private contactIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.userKeys = new Map();
    
    this.userIdCounter = 1;
    this.contactIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24h
    });
  }
  
  // Key methods
  async storeUserKey(userId: number, publicKey: string): Promise<void> {
    this.userKeys.set(userId, publicKey);
  }
  
  async getUserKey(userId: number): Promise<string | undefined> {
    return this.userKeys.get(userId);
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = {
      ...insertUser, 
      id, 
      isOnline: true,
      lastSeen: now,
      avatarColor: insertUser.avatarColor || null // Ensure avatarColor is not undefined
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserStatus(id: number, isOnline: boolean): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      user.isOnline = isOnline;
      if (!isOnline) {
        user.lastSeen = new Date();
      }
      this.users.set(id, user);
    }
  }
  
  async updateLastSeen(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      user.lastSeen = new Date();
      this.users.set(id, user);
    }
  }
  
  // Contact methods
  async addContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.contactIdCounter++;
    const contact: Contact = { ...insertContact, id };
    this.contacts.set(id, contact);
    return contact;
  }
  
  async getContacts(userId: number): Promise<User[]> {
    const contactIds = Array.from(this.contacts.values())
      .filter((contact) => contact.userId === userId)
      .map((contact) => contact.contactId);
      
    return Array.from(this.users.values())
      .filter((user) => contactIds.includes(user.id));
  }
  
  // Conversation methods
  async getOrCreateConversation(user1Id: number, user2Id: number): Promise<Conversation> {
    // Look for existing conversation
    const existingConversation = Array.from(this.conversations.values()).find(
      (conv) => 
        (conv.user1Id === user1Id && conv.user2Id === user2Id) || 
        (conv.user1Id === user2Id && conv.user2Id === user1Id)
    );
    
    if (existingConversation) {
      // Update the timestamp
      existingConversation.updatedAt = new Date();
      this.conversations.set(existingConversation.id, existingConversation);
      return existingConversation;
    }
    
    // Create new conversation
    const id = this.conversationIdCounter++;
    const now = new Date();
    const conversation: Conversation = {
      id,
      user1Id,
      user2Id,
      updatedAt: now
    };
    
    this.conversations.set(id, conversation);
    return conversation;
  }
  
  async getConversationById(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  
  async getUserConversations(userId: number): Promise<ConversationWithLastMessage[]> {
    // Get all conversations for this user
    const userConversations = Array.from(this.conversations.values())
      .filter((conv) => conv.user1Id === userId || conv.user2Id === userId);
    
    // Build enhanced conversations with additional data
    const result: ConversationWithLastMessage[] = [];
    
    for (const conv of userConversations) {
      // Get the other user (contact) in the conversation
      const contactId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const contact = await this.getUser(contactId);
      
      if (!contact) continue;
      
      // Get all messages for this conversation
      const conversationMessages = Array.from(this.messages.values())
        .filter((msg) => msg.conversationId === conv.id)
        .sort((a, b) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      
      // Get last message
      const lastMessage = conversationMessages.length > 0 
        ? conversationMessages[0] 
        : null;
      
      // Count unread messages
      const unreadCount = conversationMessages.filter(
        (msg) => msg.receiverId === userId && !msg.isRead
      ).length;
      
      result.push({
        id: conv.id,
        contact: contact,
        lastMessage,
        unreadCount
      });
    }
    
    // Sort by last message time (most recent first)
    return result.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }
  
  // Message methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const message: Message = { ...insertMessage, id };
    this.messages.set(id, message);
    
    // Update the conversation timestamp
    const conversation = await this.getConversationById(insertMessage.conversationId);
    if (conversation) {
      conversation.updatedAt = new Date();
      this.conversations.set(conversation.id, conversation);
    }
    
    return message;
  }
  
  async getMessages(conversationId: number): Promise<MessageWithUser[]> {
    const conversationMessages = Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    
    // Enhance messages with sender info
    const messagesWithUser: MessageWithUser[] = [];
    
    for (const message of conversationMessages) {
      const sender = await this.getUser(message.senderId);
      if (sender) {
        const { password, ...senderWithoutPassword } = sender;
        messagesWithUser.push({
          ...message,
          sender: senderWithoutPassword
        });
      }
    }
    
    return messagesWithUser;
  }
  
  async markMessagesAsRead(conversationId: number, userId: number): Promise<void> {
    // Get all unread messages in this conversation sent to this user
    const messagesToUpdate = Array.from(this.messages.values())
      .filter((msg) => 
        msg.conversationId === conversationId && 
        msg.receiverId === userId && 
        !msg.isRead
      );
    
    // Mark each as read
    for (const message of messagesToUpdate) {
      message.isRead = true;
      this.messages.set(message.id, message);
    }
  }
}

export const storage = new MemStorage();
