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
import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { db } from './supabase';
import { IStorage } from './storage';
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

// Create a database-backed storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Set up the session store using the same database connection
    this.sessionStore = new PostgresSessionStore({
      // Using environment variables that were set with Supabase credentials
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        isOnline: true,
        lastSeen: new Date()
      })
      .returning();
    return user;
  }

  async updateUserStatus(id: number, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        isOnline,
        lastSeen: isOnline ? undefined : new Date()
      })
      .where(eq(users.id, id));
  }

  async updateLastSeen(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastSeen: new Date() })
      .where(eq(users.id, id));
  }

  // Key methods
  async storeUserKey(userId: number, publicKey: string): Promise<void> {
    // First check if key exists
    const result = await db.execute(
      sql`SELECT * FROM user_keys WHERE user_id = ${userId}`
    );
    
    if (result.rows.length > 0) {
      // Update existing key
      await db.execute(
        sql`UPDATE user_keys SET public_key = ${publicKey} WHERE user_id = ${userId}`
      );
    } else {
      // Insert new key
      await db.execute(
        sql`INSERT INTO user_keys (user_id, public_key) VALUES (${userId}, ${publicKey})`
      );
    }
  }

  async getUserKey(userId: number): Promise<string | undefined> {
    const result = await db.execute(
      sql`SELECT public_key FROM user_keys WHERE user_id = ${userId}`
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].public_key;
    }
    return undefined;
  }

  // Contact methods
  async addContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async getContacts(userId: number): Promise<User[]> {
    const userContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    const contactIds = userContacts.map(contact => contact.contactId);
    
    if (contactIds.length === 0) return [];
    
    return await db
      .select()
      .from(users)
      .where(sql`id = ANY(${contactIds})`);
  }

  // Conversation methods
  async getOrCreateConversation(user1Id: number, user2Id: number): Promise<Conversation> {
    // Look for existing direct conversation between these users
    const [existingConversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.isGroup, false),
          or(
            and(
              eq(conversations.user1Id, user1Id),
              eq(conversations.user2Id, user2Id)
            ),
            and(
              eq(conversations.user1Id, user2Id),
              eq(conversations.user2Id, user1Id)
            )
          )
        )
      );
    
    if (existingConversation) {
      // Update the timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, existingConversation.id));
      
      return existingConversation;
    }
    
    // Create new conversation
    const [conversation] = await db
      .insert(conversations)
      .values({
        user1Id,
        user2Id,
        isGroup: false,
        createdById: user1Id,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return conversation;
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    
    return conversation;
  }

  async getUserConversations(userId: number): Promise<ConversationWithLastMessage[]> {
    // Get direct message conversations
    const directConversations = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.isGroup, false),
          or(
            eq(conversations.user1Id, userId),
            eq(conversations.user2Id, userId)
          )
        )
      );
    
    // Get group conversations this user is a member of
    const groupMemberships = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true)
        )
      );
    
    const groupConversationIds = groupMemberships.map(gm => gm.conversationId);
    
    let groupConversations: Conversation[] = [];
    if (groupConversationIds.length > 0) {
      groupConversations = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.isGroup, true),
            sql`id = ANY(${groupConversationIds})`
          )
        );
    }
    
    // Combine both types of conversations
    const allConversations = [...directConversations, ...groupConversations];
    
    // Build enhanced conversations with additional data
    const result: ConversationWithLastMessage[] = [];
    
    for (const conv of allConversations) {
      // Get last message for this conversation
      const [lastMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.timestamp))
        .limit(1);
      
      // Count unread messages
      const unreadMessagesQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            eq(messages.isRead, false),
            conv.isGroup 
              ? sql`sender_id != ${userId}` 
              : eq(messages.receiverId, userId)
          )
        );
      
      const unreadCount = unreadMessagesQuery[0]?.count || 0;
      
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
          lastMessage: lastMessage || null,
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
          lastMessage: lastMessage || null,
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

  // Group conversation methods
  async createGroupConversation(groupData: Partial<InsertConversation>, creatorId: number): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values({
        isGroup: true,
        groupName: groupData.groupName,
        groupAvatar: groupData.groupAvatar,
        createdById: creatorId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Add creator as a member with admin role
    await this.addGroupMember({
      conversationId: conversation.id,
      userId: creatorId,
      role: 'admin',
      addedById: creatorId,
      isActive: true
    });
    
    return conversation;
  }

  async updateGroupConversation(id: number, groupData: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({
        ...groupData,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();
    
    return updatedConversation;
  }

  // Group member methods
  async addGroupMember(groupMember: InsertGroupMember): Promise<GroupMember> {
    const [member] = await db
      .insert(groupMembers)
      .values(groupMember)
      .returning();
    
    return member;
  }

  async getGroupMembers(conversationId: number): Promise<(GroupMember & { user: Omit<User, 'password'> })[]> {
    const members = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.conversationId, conversationId),
          eq(groupMembers.isActive, true)
        )
      );
    
    const result: (GroupMember & { user: Omit<User, 'password'> })[] = [];
    
    for (const member of members) {
      const user = await this.getUser(member.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        result.push({
          ...member,
          user: userWithoutPassword
        });
      }
    }
    
    return result;
  }

  async removeGroupMember(conversationId: number, userId: number): Promise<void> {
    await db
      .update(groupMembers)
      .set({ isActive: false })
      .where(
        and(
          eq(groupMembers.conversationId, conversationId),
          eq(groupMembers.userId, userId)
        )
      );
  }

  async updateGroupMemberRole(conversationId: number, userId: number, role: string): Promise<void> {
    await db
      .update(groupMembers)
      .set({ role })
      .where(
        and(
          eq(groupMembers.conversationId, conversationId),
          eq(groupMembers.userId, userId)
        )
      );
  }

  // Message methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    
    // Update the conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, insertMessage.conversationId));
    
    return message;
  }

  async getMessages(conversationId: number): Promise<MessageWithUser[]> {
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.timestamp));
    
    // Map to store the built messages so we can reference them for replies and forwards
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

  async getMessageById(messageId: number): Promise<MessageWithUser | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    
    if (!message) return undefined;
    
    const sender = await this.getUser(message.senderId);
    if (!sender) return undefined;
    
    const { password, ...senderWithoutPassword } = sender;
    
    let attachments = undefined;
    if (message.hasAttachment) {
      attachments = await this.getAttachmentsByMessageId(message.id);
    }
    
    const reactions = await this.getMessageReactions(message.id);
    
    const edits = message.isEdited 
      ? await this.getMessageEdits(message.id)
      : undefined;
    
    const enhancedMessage: MessageWithUser = {
      ...message,
      sender: senderWithoutPassword,
      attachments,
      reactions: reactions.length > 0 ? reactions : undefined,
      edits: edits?.length ? edits : undefined
    };
    
    return enhancedMessage;
  }

  async markMessagesAsRead(conversationId: number, userId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.receiverId, userId),
          eq(messages.isRead, false)
        )
      );
  }

  async editMessage(messageId: number, newContent: string, encryptionDetails?: { isEncrypted: boolean, encryptionType: string, nonce: string }): Promise<Message> {
    // First, get the original message to save in history
    const [originalMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    
    if (!originalMessage) {
      throw new Error("Message not found");
    }
    
    // Create a message edit record
    const messageEdit: Partial<MessageEdit> = {
      messageId,
      previousContent: originalMessage.content || "",
      timestamp: new Date(),
      editorId: originalMessage.senderId // Assuming only sender can edit
    };
    
    await db
      .insert(messageEdits)
      .values(messageEdit);
    
    // Update the message
    const [updatedMessage] = await db
      .update(messages)
      .set({
        content: newContent,
        isEdited: true,
        ...(encryptionDetails && {
          isEncrypted: encryptionDetails.isEncrypted,
          encryptionType: encryptionDetails.encryptionType,
          nonce: encryptionDetails.nonce
        })
      })
      .where(eq(messages.id, messageId))
      .returning();
    
    return updatedMessage;
  }

  async deleteMessage(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({
        isDeleted: true,
        content: null // Remove content for privacy
      })
      .where(eq(messages.id, messageId));
  }

  async forwardMessage(originalMessageId: number, newConversationId: number, senderId: number, receiverId?: number): Promise<Message> {
    // Get the original message
    const [originalMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, originalMessageId));
    
    if (!originalMessage) {
      throw new Error("Original message not found");
    }
    
    // Create a new forwarded message
    const forwardMessage: Partial<InsertMessage> = {
      conversationId: newConversationId,
      senderId,
      receiverId: receiverId,
      content: originalMessage.content,
      messageType: originalMessage.messageType,
      isEncrypted: originalMessage.isEncrypted,
      encryptionType: originalMessage.encryptionType,
      nonce: originalMessage.nonce,
      timestamp: new Date(),
      isRead: false,
      hasAttachment: originalMessage.hasAttachment,
      forwardedFromId: originalMessageId
    };
    
    const [newMessage] = await db
      .insert(messages)
      .values(forwardMessage)
      .returning();
    
    // If original had attachments, copy them to the new message
    if (originalMessage.hasAttachment) {
      const attachments = await this.getAttachmentsByMessageId(originalMessageId);
      
      for (const attachment of attachments) {
        await db
          .insert(attachments)
          .values({
            messageId: newMessage.id,
            fileName: attachment.fileName,
            filePath: attachment.filePath,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            thumbnailPath: attachment.thumbnailPath
          });
      }
    }
    
    return newMessage;
  }

  // Message reactions
  async addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction> {
    // Check if this user already reacted with this emoji
    const [existingReaction] = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, reaction.messageId),
          eq(messageReactions.userId, reaction.userId),
          eq(messageReactions.reaction, reaction.reaction)
        )
      );
    
    if (existingReaction) {
      return existingReaction; // Reaction already exists
    }
    
    // Create new reaction
    const [newReaction] = await db
      .insert(messageReactions)
      .values(reaction)
      .returning();
    
    return newReaction;
  }

  async getMessageReactions(messageId: number): Promise<(MessageReaction & { user: Omit<User, 'password'> })[]> {
    const reactions = await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));
    
    const result: (MessageReaction & { user: Omit<User, 'password'> })[] = [];
    
    for (const reaction of reactions) {
      const user = await this.getUser(reaction.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        result.push({
          ...reaction,
          user: userWithoutPassword
        });
      }
    }
    
    return result;
  }

  async removeMessageReaction(messageId: number, userId: number, reaction: string): Promise<void> {
    await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.reaction, reaction)
        )
      );
  }

  // Message edits
  async getMessageEdits(messageId: number): Promise<MessageEdit[]> {
    return await db
      .select()
      .from(messageEdits)
      .where(eq(messageEdits.messageId, messageId))
      .orderBy(desc(messageEdits.timestamp));
  }

  // Attachment methods
  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db
      .insert(attachments)
      .values(attachment)
      .returning();
    
    // Update the message to indicate it has an attachment
    await db
      .update(messages)
      .set({ hasAttachment: true })
      .where(eq(messages.id, attachment.messageId));
    
    return newAttachment;
  }

  async getAttachmentsByMessageId(messageId: number): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, messageId));
  }

  async getAttachment(id: number): Promise<Attachment | undefined> {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id));
    
    return attachment;
  }
}