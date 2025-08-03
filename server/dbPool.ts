// Database connection pool for improved performance
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

let db: any = null;

export const getDb = () => {
  if (!db) {
    const connection = neon(process.env.DATABASE_URL!);
    db = drizzle(connection);
  }
  return db;
};

// Keep connection alive
setInterval(() => {
  if (db) {
    // Simple query to keep connection alive
    db.execute('SELECT 1').catch(() => {});
  }
}, 30000); // Every 30 seconds