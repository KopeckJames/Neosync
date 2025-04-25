/**
 * This script sets the environment variable for using the database
 * and then restarts the application.
 */

import { execSync } from 'child_process';

// Set the environment variable to use the database
process.env.USE_DATABASE = 'true';

// Log the change
console.log('Database integration enabled. Restarting server...');

// Run the application with the new environment variable
try {
  execSync('NODE_ENV=development USE_DATABASE=true tsx server/index.ts', { 
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Error starting server with database integration:', error);
}