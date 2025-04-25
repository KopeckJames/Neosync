import { 
  users, type User, type InsertUser,
  contacts, type Contact, type InsertContact,
  conversations, type Conversation, type InsertConversation, 
  messages, type Message, type InsertMessage,
  attachments, type Attachment, type InsertAttachment,
  groupMembers, type GroupMember, type InsertGroupMember,
  messageReactions, type MessageReaction, type InsertMessageReaction,
  messageEdits, type MessageEdit, type InsertMessageEdit,
  type ConversationWithLastMessage, type MessageWithUser,
  type AttachmentWithThumbnail
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
  createGroupConversation(groupData: Partial<InsertConversation>, creatorId: number): Promise<Conversation>;
  updateGroupConversation(id: number, groupData: Partial<Conversation>): Promise<Conversation | undefined>;
  
  // Group member methods
  addGroupMember(groupMember: InsertGroupMember): Promise<GroupMember>;
  getGroupMembers(conversationId: number): Promise<(GroupMember & { user: Omit<User, 'password'> })[]>;
  removeGroupMember(conversationId: number, userId: number): Promise<void>;
  updateGroupMemberRole(conversationId: number, userId: number, role: string): Promise<void>;
  
  // Message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: number): Promise<MessageWithUser[]>;
  getMessageById(messageId: number): Promise<MessageWithUser | undefined>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  editMessage(messageId: number, newContent: string, encryptionDetails?: { isEncrypted: boolean, encryptionType: string, nonce: string }): Promise<Message>;
  deleteMessage(messageId: number): Promise<void>;
  forwardMessage(originalMessageId: number, newConversationId: number, senderId: number, receiverId?: number): Promise<Message>;
  
  // Message reactions
  addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  getMessageReactions(messageId: number): Promise<(MessageReaction & { user: Omit<User, 'password'> })[]>;
  removeMessageReaction(messageId: number, userId: number, reaction: string): Promise<void>;
  
  // Message edits
  getMessageEdits(messageId: number): Promise<MessageEdit[]>;
  
  // Attachment methods
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachmentsByMessageId(messageId: number): Promise<Attachment[]>;
  getAttachment(id: number): Promise<Attachment | undefined>;
  
  // Session store
  sessionStore: any; // Using 'any' to avoid TypeScript issues with session.SessionStore
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contacts: Map<number, Contact>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private userKeys: Map<number, string>; // Store user public keys
  private attachments: Map<number, Attachment>; // Store file attachments
  private groupMembers: Map<number, GroupMember>; // Store group members
  private messageReactions: Map<number, MessageReaction>; // Store message reactions
  private messageEdits: Map<number, MessageEdit>; // Store message edits history
  sessionStore: any; // Using 'any' to avoid TypeScript issues
  
  private userIdCounter: number;
  private contactIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private attachmentIdCounter: number;
  private groupMemberIdCounter: number;
  private messageReactionIdCounter: number;
  private messageEditIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.userKeys = new Map();
    this.attachments = new Map();
    this.groupMembers = new Map();
    this.messageReactions = new Map();
    this.messageEdits = new Map();
    
    this.userIdCounter = 1;
    this.contactIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.attachmentIdCounter = 1;
    this.groupMemberIdCounter = 1;
    this.messageReactionIdCounter = 1;
    this.messageEditIdCounter = 1;
    
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
    
    // Create the user with types that match the schema
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      displayName: insertUser.displayName,
      avatarColor: insertUser.avatarColor || null,
      isOnline: true,
      lastSeen: now
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
    // Look for existing conversation for direct messages
    const existingConversation = Array.from(this.conversations.values()).find(
      (conv) => 
        !conv.isGroup && 
        ((conv.user1Id === user1Id && conv.user2Id === user2Id) || 
        (conv.user1Id === user2Id && conv.user2Id === user1Id))
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
      isGroup: false,
      groupName: null,
      groupAvatar: null,
      createdById: user1Id,
      updatedAt: now,
      createdAt: now
    };
    
    this.conversations.set(id, conversation);
    return conversation;
  }
  
  async getConversationById(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  
  async getUserConversations(userId: number): Promise<ConversationWithLastMessage[]> {
    // Get direct message conversations for this user
    const directConversations = Array.from(this.conversations.values())
      .filter((conv) => 
        !conv.isGroup && (conv.user1Id === userId || conv.user2Id === userId)
      );
    
    // Get group conversations this user is a member of
    const groupMembers = Array.from(this.groupMembers.values())
      .filter((member) => member.userId === userId && member.isActive);
    
    const groupConversations = Array.from(this.conversations.values())
      .filter((conv) => 
        conv.isGroup && 
        groupMembers.some(member => member.conversationId === conv.id)
      );
    
    // Combine both types of conversations
    const allConversations = [...directConversations, ...groupConversations];
    
    // Build enhanced conversations with additional data
    const result: ConversationWithLastMessage[] = [];
    
    for (const conv of allConversations) {
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
      
      // Count unread messages (for direct messages, check receiverId; for groups check all messages to this user)
      const unreadCount = conversationMessages.filter(
        (msg) => {
          if (conv.isGroup) {
            return msg.senderId !== userId && !msg.isRead; // Any unread message not from this user
          } else {
            return msg.receiverId === userId && !msg.isRead; // Direct message to this user
          }
        }
      ).length;
      
      if (conv.isGroup) {
        // For group chats, get all members
        const members = await this.getGroupMembers(conv.id);
        const memberUsers = members.map(m => m.user);
        
        result.push({
          id: conv.id,
          isGroup: true,
          groupName: conv.groupName,
          groupAvatar: conv.groupAvatar,
          members: memberUsers,
          lastMessage,
          unreadCount
        });
      } else {
        // For direct messages, get the other user (contact)
        const contactId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
        const contact = await this.getUser(contactId);
        
        if (!contact) continue;
        
        result.push({
          id: conv.id,
          isGroup: false,
          contact,
          lastMessage,
          unreadCount
        });
      }
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
    
    // Create message with fully specified types to match the schema
    const message: Message = {
      id,
      conversationId: insertMessage.conversationId,
      senderId: insertMessage.senderId,
      receiverId: insertMessage.receiverId,
      content: insertMessage.content ?? null,
      messageType: insertMessage.messageType ?? 'text',
      isEncrypted: insertMessage.isEncrypted === undefined ? true : insertMessage.isEncrypted,
      encryptionType: insertMessage.encryptionType || null,
      nonce: insertMessage.nonce || null,
      timestamp: insertMessage.timestamp,
      isRead: insertMessage.isRead === undefined ? false : insertMessage.isRead,
      hasAttachment: insertMessage.hasAttachment === undefined ? false : insertMessage.hasAttachment,
      isEdited: insertMessage.isEdited || false,
      isDeleted: insertMessage.isDeleted || false,
      replyToId: insertMessage.replyToId || null,
      forwardedFromId: insertMessage.forwardedFromId || null,
      expiresAt: insertMessage.expiresAt || null
    };
    
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
    
    // Map to store the built messages so we can reference them for replies and forwarded messages
    const messageMap = new Map<number, MessageWithUser>();

    // First pass: Create basic messages with sender info and attachments
    for (const message of conversationMessages) {
      const sender = await this.getUser(message.senderId);
      if (sender) {
        const { password, ...senderWithoutPassword } = sender;
        
        // Get any attachments for this message
        let attachments = undefined;
        if (message.hasAttachment) {
          attachments = await this.getAttachmentsByMessageId(message.id);
        }
        
        // Get any reactions for this message
        const reactions = await this.getMessageReactions(message.id);
        
        // Get edit history for this message
        const edits = message.isEdited ? await this.getMessageEdits(message.id) : undefined;
        
        const enhancedMessage: MessageWithUser = {
          ...message,
          sender: senderWithoutPassword,
          attachments,
          reactions: reactions.length > 0 ? reactions : undefined,
          edits: edits?.length ? edits : undefined
        };
        
        messageMap.set(message.id, enhancedMessage);
      }
    }
    
    // Second pass: Add references to reply/forwarded messages
    for (const messageId of messageMap.keys()) {
      const message = messageMap.get(messageId)!;
      
      // Handle reply messages
      if (message.replyToId) {
        const replyToMessage = messageMap.get(message.replyToId) || 
                              await this.getMessageById(message.replyToId);
        if (replyToMessage) {
          message.replyTo = replyToMessage;
        }
      }
      
      // Handle forwarded messages
      if (message.forwardedFromId) {
        const forwardedFromMessage = messageMap.get(message.forwardedFromId) || 
                                    await this.getMessageById(message.forwardedFromId);
        if (forwardedFromMessage) {
          message.forwardedFrom = forwardedFromMessage;
        }
      }
    }
    
    return Array.from(messageMap.values());
  }
  
  // Get a single message with user info by ID
  async getMessageById(messageId: number): Promise<MessageWithUser | undefined> {
    const message = this.messages.get(messageId);
    if (!message) return undefined;
    
    const sender = await this.getUser(message.senderId);
    if (!sender) return undefined;
    
    const { password, ...senderWithoutPassword } = sender;
    
    let attachments = undefined;
    if (message.hasAttachment) {
      attachments = await this.getAttachmentsByMessageId(message.id);
    }
    
    return {
      ...message,
      sender: senderWithoutPassword,
      attachments
    };
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
  
  // Attachment methods
  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const id = this.attachmentIdCounter++;
    
    const attachment: Attachment = {
      id,
      messageId: insertAttachment.messageId,
      filename: insertAttachment.filename,
      fileType: insertAttachment.fileType,
      fileSize: insertAttachment.fileSize,
      filePath: insertAttachment.filePath,
      thumbnailPath: insertAttachment.thumbnailPath || null,
      isEncrypted: insertAttachment.isEncrypted === undefined ? true : insertAttachment.isEncrypted,
      nonce: insertAttachment.nonce || null,
      uploadedAt: new Date()
    };
    
    this.attachments.set(id, attachment);
    
    // Update the message to indicate it has an attachment
    const message = this.messages.get(insertAttachment.messageId);
    if (message) {
      message.hasAttachment = true;
      // Update message type based on file type if not already set
      if (message.messageType === 'text') {
        if (insertAttachment.fileType.startsWith('image/')) {
          message.messageType = 'image';
        } else if (insertAttachment.fileType.startsWith('video/')) {
          message.messageType = 'video';
        } else if (insertAttachment.fileType.startsWith('audio/')) {
          message.messageType = 'audio';
        } else {
          message.messageType = 'file';
        }
      }
      this.messages.set(message.id, message);
    }
    
    return attachment;
  }
  
  async getAttachmentsByMessageId(messageId: number): Promise<Attachment[]> {
    return Array.from(this.attachments.values())
      .filter(attachment => attachment.messageId === messageId);
  }
  
  async getAttachment(id: number): Promise<Attachment | undefined> {
    return this.attachments.get(id);
  }

  // Message reactions methods
  async addMessageReaction(insertReaction: InsertMessageReaction): Promise<MessageReaction> {
    // Check if a reaction already exists from this user on this message
    const existingReaction = Array.from(this.messageReactions.values()).find(
      r => r.messageId === insertReaction.messageId && r.userId === insertReaction.userId && r.reaction === insertReaction.reaction
    );

    if (existingReaction) {
      return existingReaction;
    }

    const id = this.messageReactionIdCounter++;
    const now = new Date();
    
    const reaction: MessageReaction = {
      id,
      messageId: insertReaction.messageId,
      userId: insertReaction.userId,
      reaction: insertReaction.reaction,
      createdAt: now
    };
    
    this.messageReactions.set(id, reaction);
    return reaction;
  }

  async getMessageReactions(messageId: number): Promise<(MessageReaction & { user: Omit<User, 'password'> })[]> {
    const reactions = Array.from(this.messageReactions.values())
      .filter(reaction => reaction.messageId === messageId);
    
    const reactionsWithUser: (MessageReaction & { user: Omit<User, 'password'> })[] = [];
    
    for (const reaction of reactions) {
      const user = await this.getUser(reaction.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        reactionsWithUser.push({
          ...reaction,
          user: userWithoutPassword
        });
      }
    }
    
    return reactionsWithUser;
  }

  async removeMessageReaction(messageId: number, userId: number, reaction: string): Promise<void> {
    const targetReaction = Array.from(this.messageReactions.values()).find(
      r => r.messageId === messageId && r.userId === userId && r.reaction === reaction
    );
    
    if (targetReaction) {
      this.messageReactions.delete(targetReaction.id);
    }
  }

  // Message editing methods
  async editMessage(messageId: number, newContent: string, encryptionDetails?: { isEncrypted: boolean, encryptionType: string, nonce: string }): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Create edit history record
    const editId = this.messageEditIdCounter++;
    const now = new Date();
    
    const messageEdit: MessageEdit = {
      id: editId,
      messageId: messageId,
      content: message.content || "",
      editedAt: now,
      isEncrypted: message.isEncrypted || false,
      encryptionType: message.encryptionType || null,
      nonce: message.nonce || null
    };
    
    this.messageEdits.set(editId, messageEdit);
    
    // Update the message
    message.content = newContent;
    message.isEdited = true;
    
    if (encryptionDetails) {
      message.isEncrypted = encryptionDetails.isEncrypted;
      message.encryptionType = encryptionDetails.encryptionType;
      message.nonce = encryptionDetails.nonce;
    }
    
    this.messages.set(messageId, message);
    return message;
  }

  async getMessageEdits(messageId: number): Promise<MessageEdit[]> {
    return Array.from(this.messageEdits.values())
      .filter(edit => edit.messageId === messageId)
      .sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime());
  }

  async deleteMessage(messageId: number): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.isDeleted = true;
      message.content = null; // Redact content for privacy
      this.messages.set(messageId, message);
    }
  }

  async forwardMessage(originalMessageId: number, newConversationId: number, senderId: number, receiverId?: number): Promise<Message> {
    const originalMessage = this.messages.get(originalMessageId);
    if (!originalMessage) {
      throw new Error("Original message not found");
    }
    
    const now = new Date();
    
    // Create new message with the same content but new metadata
    const forwardMessage: InsertMessage = {
      conversationId: newConversationId,
      senderId: senderId,
      receiverId: receiverId || null,
      content: originalMessage.content,
      messageType: originalMessage.messageType,
      isEncrypted: originalMessage.isEncrypted,
      encryptionType: originalMessage.encryptionType,
      nonce: originalMessage.nonce,
      timestamp: now,
      forwardedFromId: originalMessageId
    };
    
    return this.createMessage(forwardMessage);
  }

  // Group conversation methods
  async createGroupConversation(groupData: Partial<InsertConversation>, creatorId: number): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const now = new Date();
    
    const conversation: Conversation = {
      id,
      user1Id: creatorId,
      user2Id: null,
      isGroup: true,
      groupName: groupData.groupName || null,
      groupAvatar: groupData.groupAvatar || null,
      createdById: creatorId,
      updatedAt: now,
      createdAt: now
    };
    
    this.conversations.set(id, conversation);
    
    // Add creator as admin member
    await this.addGroupMember({
      conversationId: id,
      userId: creatorId,
      role: "admin",
      addedById: creatorId,
      isActive: true
    });
    
    return conversation;
  }

  async updateGroupConversation(id: number, groupData: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation || !conversation.isGroup) {
      return undefined;
    }
    
    const updatedConversation: Conversation = {
      ...conversation,
      ...groupData,
      updatedAt: new Date()
    };
    
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  // Group member methods
  async addGroupMember(groupMember: InsertGroupMember): Promise<GroupMember> {
    const id = this.groupMemberIdCounter++;
    const now = new Date();
    
    const member: GroupMember = {
      id,
      conversationId: groupMember.conversationId,
      userId: groupMember.userId,
      role: groupMember.role || "member",
      addedById: groupMember.addedById,
      addedAt: now,
      isActive: groupMember.isActive === undefined ? true : groupMember.isActive
    };
    
    this.groupMembers.set(id, member);
    return member;
  }

  async getGroupMembers(conversationId: number): Promise<(GroupMember & { user: Omit<User, 'password'> })[]> {
    const members = Array.from(this.groupMembers.values())
      .filter(member => member.conversationId === conversationId && member.isActive);
    
    const membersWithUser: (GroupMember & { user: Omit<User, 'password'> })[] = [];
    
    for (const member of members) {
      const user = await this.getUser(member.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        membersWithUser.push({
          ...member,
          user: userWithoutPassword
        });
      }
    }
    
    return membersWithUser;
  }

  async removeGroupMember(conversationId: number, userId: number): Promise<void> {
    const member = Array.from(this.groupMembers.values()).find(
      m => m.conversationId === conversationId && m.userId === userId
    );
    
    if (member) {
      member.isActive = false;
      this.groupMembers.set(member.id, member);
    }
  }

  async updateGroupMemberRole(conversationId: number, userId: number, role: string): Promise<void> {
    const member = Array.from(this.groupMembers.values()).find(
      m => m.conversationId === conversationId && m.userId === userId
    );
    
    if (member) {
      member.role = role;
      this.groupMembers.set(member.id, member);
    }
  }
}

export const storage = new MemStorage();
