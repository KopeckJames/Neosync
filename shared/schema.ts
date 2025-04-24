import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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
  user2Id: integer("user2_id").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  user1Id: true,
  user2Id: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  isEncrypted: boolean("is_encrypted").default(true),
  encryptionType: text("encryption_type").default("sodium"),
  nonce: text("nonce"), // For encrypted messages (base64 encoded)
  timestamp: timestamp("timestamp").notNull(),
  isRead: boolean("is_read").default(false),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  senderId: true,
  receiverId: true,
  content: true,
  isEncrypted: true,
  encryptionType: true,
  nonce: true,
  timestamp: true,
  isRead: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended types for API responses
export type ConversationWithLastMessage = {
  id: number;
  contact: User;
  lastMessage: Message | null;
  unreadCount: number;
};

export type MessageWithUser = Message & {
  sender: Omit<User, 'password'>;
};
