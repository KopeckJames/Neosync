import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_API_KEY must be set in the environment variables");
}

// Create a connection string for Supabase PostgreSQL database
// Format: postgres://postgres:[API_KEY]@db.[PROJECT_ID].supabase.co:5432/postgres
const supabaseHost = process.env.SUPABASE_URL.replace('https://', '');
const connectionString = `postgres://postgres:${process.env.SUPABASE_API_KEY}@db.${supabaseHost}:5432/postgres`;

// Create the connection pool
export const pool = new Pool({ connectionString });

// Create the Drizzle ORM instance
export const db = drizzle(pool, { schema });