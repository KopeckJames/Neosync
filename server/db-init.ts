import { db } from './supabase';
import * as schema from '@shared/schema';
import { sql } from 'drizzle-orm';

// Function to initialize the database
export async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');
    
    // Create tables if they don't exist
    await createUsersTable();
    await createUserKeysTable();
    await createContactsTable();
    await createConversationsTable();
    await createMessagesTable();
    await createAttachmentsTable();
    await createGroupMembersTable();
    await createMessageReactionsTable();
    await createMessageEditsTable();
    
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Helper functions to create each table
async function createUsersTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      avatar_color VARCHAR(255),
      last_seen TIMESTAMP,
      is_online BOOLEAN
    )
  `);
}

async function createUserKeysTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_keys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      public_key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createContactsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      contact_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, contact_id)
    )
  `);
}

async function createConversationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user1_id INTEGER REFERENCES users(id),
      user2_id INTEGER REFERENCES users(id),
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      group_name VARCHAR(255),
      group_avatar VARCHAR(255),
      created_by_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createMessagesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER REFERENCES users(id),
      content TEXT,
      message_type VARCHAR(50) DEFAULT 'text',
      is_encrypted BOOLEAN DEFAULT TRUE,
      encryption_type VARCHAR(50),
      nonce TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT FALSE,
      has_attachment BOOLEAN DEFAULT FALSE,
      is_edited BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      reply_to_id INTEGER REFERENCES messages(id),
      forwarded_from_id INTEGER REFERENCES messages(id),
      expires_at TIMESTAMP
    )
  `);
}

async function createAttachmentsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id),
      file_name VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      file_size INTEGER NOT NULL,
      thumbnail_path TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createGroupMembersTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role VARCHAR(50) DEFAULT 'member',
      added_by_id INTEGER NOT NULL REFERENCES users(id),
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(conversation_id, user_id)
    )
  `);
}

async function createMessageReactionsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      reaction VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, reaction)
    )
  `);
}

async function createMessageEditsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS message_edits (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id),
      previous_content TEXT NOT NULL,
      editor_id INTEGER NOT NULL REFERENCES users(id),
      edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}