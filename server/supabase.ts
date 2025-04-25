import { createClient } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_API_KEY must be set in the environment variables");
}

// Create a Neon client that uses Supabase's Postgres connection string
// We're using the DATABASE_URL format: postgres://username:password@host:port/database
const connectionString = `${process.env.SUPABASE_URL.replace('https://', 'postgres://postgres:')}${process.env.SUPABASE_API_KEY}@db.${process.env.SUPABASE_URL.replace('https://', '')}/postgres`;

// Create the Neon serverless client
export const client = createClient({ connectionString });

// Create the Drizzle ORM instance
export const db = drizzle({ client, schema });