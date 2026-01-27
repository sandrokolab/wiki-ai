const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false
});

// Initialize tables for PostgreSQL
const initialize = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE,
        icon TEXT DEFAULT 'ph-hash',
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        parent_id INTEGER REFERENCES topics(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pages(
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE,
        title TEXT,
        content TEXT,
        category TEXT,
        topic_id INTEGER REFERENCES topics(id),
        author_id INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'draft',
        is_verified BOOLEAN DEFAULT false,
        allow_comments BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations for existing pages table
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorites(
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      page_id INTEGER REFERENCES pages(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, page_id)
    )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorite_topics(
      user_id INTEGER REFERENCES users(id),
      topic_id INTEGER REFERENCES topics(id),
      PRIMARY KEY(user_id, topic_id)
    )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_topics(
  user_id INTEGER REFERENCES users(id),
  topic_id INTEGER REFERENCES topics(id),
  PRIMARY KEY(user_id, topic_id)
)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_revisions(
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id),
        content TEXT,
        author_id INTEGER REFERENCES users(id),
        change_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration for page_revisions
    await client.query(`ALTER TABLE page_revisions ADD COLUMN IF NOT EXISTS change_summary TEXT`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action_type TEXT,
        page_id INTEGER REFERENCES pages(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL tables initialized.');
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL tables:', e);
  } finally {
    if (client) client.release();
  }
};

initialize();

module.exports = pool;
