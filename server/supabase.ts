import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";
import ws from 'ws';

// Configure Neon to use the ws package for WebSocket connections
neonConfig.webSocketConstructor = ws;

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_API_KEY must be set in the environment variables");
}

// Create a direct connection to Supabase PostgreSQL using DATABASE_URL
// This should work because we have a DATABASE_URL environment variable set
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not found, constructing from SUPABASE credentials");
  // Create a connection string for Supabase PostgreSQL database
  const supabaseHost = process.env.SUPABASE_URL.replace('https://', '');
  process.env.DATABASE_URL = `postgres://postgres:${process.env.SUPABASE_API_KEY}@db.${supabaseHost}:5432/postgres`;
}

// Create the connection pool using the DATABASE_URL
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create the Drizzle ORM instance
export const db = drizzle(pool, { schema });