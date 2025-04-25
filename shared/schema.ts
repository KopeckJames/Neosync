import { pgTable, text, serial, integer, boolean, timestamp, json, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  avatarColor: text("avatar_color"),
  lastSeen: timestamp("last_seen"),
  isOnline: boolean("is_online").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatarColor: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User public keys for encryption
export const userKeys = pgTable("user_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserKeySchema = createInsertSchema(userKeys).pick({
  userId: true,
  publicKey: true,
});

export type InsertUserKey = z.infer<typeof insertUserKeySchema>;
export type UserKey = typeof userKeys.$inferSelect;

// Contacts
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contactId: integer("contact_id").notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  userId: true,
  contactId: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull(),
  user2Id: integer("user2_id"),  // Can be null for group chats
  isGroup: boolean("is_group").default(false).notNull(),
  groupName: text("group_name"),
  groupAvatar: text("group_avatar"),
  createdById: integer("created_by_id"),
  updatedAt: timestamp("updated_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  user1Id: true,
  user2Id: true,
  isGroup: true,
  groupName: true,
  groupAvatar: true,
  createdById: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// File attachments
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  isEncrypted: boolean("is_encrypted").default(true),
  nonce: text("nonce"), // For encrypted files
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).pick({
  messageId: true,
  filename: true,
  fileType: true,
  fileSize: true,
  filePath: true,
  thumbnailPath: true,
  isEncrypted: true,
  nonce: true,
});

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id"), // Can be null for group chats
  content: text("content"),  // Can be null if it's a file-only message
  messageType: varchar("message_type", { length: 20 }).notNull().default("text"), // text, image, file, audio, video
  isEncrypted: boolean("is_encrypted").default(true),
  encryptionType: text("encryption_type").default("sodium"),
  nonce: text("nonce"), // For encrypted messages (base64 encoded)
  timestamp: timestamp("timestamp").notNull(),
  isRead: boolean("is_read").default(false),
  hasAttachment: boolean("has_attachment").default(false),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  replyToId: integer("reply_to_id"), // For reply threads
  forwardedFromId: integer("forwarded_from_id"), // Original message ID if forwarded
  expiresAt: timestamp("expires_at"), // For message self-destruction
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  senderId: true,
  receiverId: true,
  content: true,
  messageType: true,
  isEncrypted: true,
  encryptionType: true,
  nonce: true,
  timestamp: true,
  isRead: true,
  hasAttachment: true,
  isEdited: true,
  isDeleted: true,
  replyToId: true,
  forwardedFromId: true,
  expiresAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended types for API responses
export type ConversationWithLastMessage = {
  id: number;
  contact?: User;
  members?: Omit<User, 'password'>[];
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  lastMessage: Message | null;
  unreadCount: number;
};

export type MessageWithUser = Message & {
  sender: Omit<User, 'password'>;
  attachments?: Attachment[];
  reactions?: (MessageReaction & { user: Omit<User, 'password'> })[];
  replyTo?: MessageWithUser;
  forwardedFrom?: MessageWithUser;
  edits?: MessageEdit[];
  highlighted?: boolean; // Used for UI to highlight a message when scrolled to
  scheduledFor?: string; // ISO date string for scheduled messages
};

export type AttachmentWithThumbnail = Attachment & {
  thumbnailUrl?: string;
  downloadUrl: string;
};

// Group Members
export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  userId: integer("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"), // admin, member
  addedById: integer("added_by_id").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).pick({
  conversationId: true,
  userId: true,
  role: true,
  addedById: true,
  isActive: true,
});

export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;

// Message Reactions
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull(),
  reaction: varchar("reaction", { length: 20 }).notNull(), // emoji code
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).pick({
  messageId: true,
  userId: true,
  reaction: true,
});

export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type MessageReaction = typeof messageReactions.$inferSelect;

// Update messages table to support editing and reply functionality
export const messageEdits = pgTable("message_edits", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  content: text("content").notNull(),
  editedAt: timestamp("edited_at").notNull().defaultNow(),
  isEncrypted: boolean("is_encrypted").default(true),
  encryptionType: text("encryption_type").default("sodium"),
  nonce: text("nonce"), // For encrypted messages (base64 encoded)
});

export const insertMessageEditSchema = createInsertSchema(messageEdits).pick({
  messageId: true,
  content: true,
  isEncrypted: true,
  encryptionType: true,
  nonce: true,
});

export type InsertMessageEdit = z.infer<typeof insertMessageEditSchema>;
export type MessageEdit = typeof messageEdits.$inferSelect;
