require('dotenv').config();
const { pool } = require('./index');

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create proverbs table with vector column
    await client.query(`
      CREATE TABLE IF NOT EXISTS proverbs (
        id SERIAL PRIMARY KEY,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        vector vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chapter, verse)
      )
    `);

    // Create index on vector column for similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS proverbs_vector_idx
      ON proverbs
      USING ivfflat (vector vector_cosine_ops)
      WITH (lists = 100)
    `);

    // Create index on chapter for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS proverbs_chapter_idx ON proverbs(chapter)
    `);

    // Create sessions table for connect-pg-simple (if not auto-created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire)
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
