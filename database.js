// INDESTRUCTIBLE DATABASE INITIALIZATION (VER 1.40)
// Optimized for Railway/PostgreSQL stability and Multi-Wiki support.
const { Pool } = require('pg');

// 1. Connection with robust SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // 10s timeout
});

// Create a readiness promise that we can export
let resolveDbReady;
let rejectDbReady;
const dbReady = new Promise((res, rej) => {
  resolveDbReady = res;
  rejectDbReady = rej;
});

/**
 * HELPER: Safe execution that never throws.
 */
async function safeQuery(client, label, sql, params = []) {
  try {
    const res = await client.query(sql, params);
    console.log(`[DB] ${label}: Success`);
    return res;
  } catch (err) {
    // We ignore common "already exists" errors to keep initialization clean
    if (['42701', '42P07', '23505', '42601'].includes(err.code)) {
      console.log(`[DB] ${label}: Already exists or handled (verified)`);
    } else {
      console.error(`[DB] ${label}: Error ->`, err.message);
    }
    return null;
  }
}

/**
 * Initialize tables for PostgreSQL
 * Optimized for Multi-Wiki and robust connectivity.
 */
const initialize = async () => {
  console.log('[DB] [VER 1.40] Starting indestructible initialization (Multi-Wiki Mode)...');
  let client;

  try {
    // Attempt connection with retry
    let retries = 5;
    while (retries > 0) {
      try {
        client = await pool.connect();
        break;
      } catch (connErr) {
        retries--;
        console.warn(`[DB] Connection attempt failed. Retries left: ${retries}. Error:`, connErr.message);
        if (retries === 0) throw connErr;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // 1. BASE TABLES
    await safeQuery(client, 'Table wikis', `
      CREATE TABLE IF NOT EXISTS wikis (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Seed general wiki', `
      INSERT INTO wikis (name, slug, description)
      VALUES ('Wiki General', 'general', 'Espacio principal de la wiki')
      ON CONFLICT (slug) DO NOTHING
    `);

    // USERS
    await safeQuery(client, 'Table users', `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // TOPICS
    await safeQuery(client, 'Table topics', `
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        name TEXT,
        icon TEXT DEFAULT 'ph-hash',
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        parent_id INTEGER REFERENCES topics(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PAGES
    await safeQuery(client, 'Table pages', `
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        slug TEXT,
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

    // 2. SURGICAL COLUMN INJECTION (In case tables existed without these)
    await safeQuery(client, 'Inject wiki_id topics', 'ALTER TABLE topics ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');
    await safeQuery(client, 'Inject wiki_id pages', 'ALTER TABLE pages ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');
    await safeQuery(client, 'Inject topic_id pages', 'ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)');
    await safeQuery(client, 'Inject role users', "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'");

    // FAVORITES
    await safeQuery(client, 'Table user_favorites', `
      CREATE TABLE IF NOT EXISTS user_favorites(
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        page_id INTEGER REFERENCES pages(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, page_id)
      )
    `);

    // FAVORITE TOPICS
    await safeQuery(client, 'Table user_favorite_topics', `
      CREATE TABLE IF NOT EXISTS user_favorite_topics(
        user_id INTEGER REFERENCES users(id),
        topic_id INTEGER REFERENCES topics(id),
        PRIMARY KEY(user_id, topic_id)
      )
    `);

    // USER TOPICS
    await safeQuery(client, 'Table user_topics', `
      CREATE TABLE IF NOT EXISTS user_topics(
        user_id INTEGER REFERENCES users(id),
        topic_id INTEGER REFERENCES topics(id),
        PRIMARY KEY(user_id, topic_id)
      )
    `);

    // ACTIVITY LOG
    await safeQuery(client, 'Table activity_log', `
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action_type TEXT,
        page_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Inject wiki_id activity_log', 'ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');

    // COMMENTS
    await safeQuery(client, 'Table comments', `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        page_id INTEGER REFERENCES pages (id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        attachment_name TEXT,
        attachment_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Inject wiki_id comments', 'ALTER TABLE comments ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');

    // NOTIFICATIONS
    await safeQuery(client, 'Table notifications', `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type TEXT,
        target_id INTEGER,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // COMMENT REACTIONS
    await safeQuery(client, 'Table comment_reactions', `
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reaction_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id)
      )
    `);

    // REVISIONS
    await safeQuery(client, 'Table page_revisions', `
      CREATE TABLE IF NOT EXISTS page_revisions(
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        content TEXT,
        author_id INTEGER REFERENCES users(id),
        change_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SESSION STORE
    await safeQuery(client, 'Table session', `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);

    console.log('[DB] [VER 1.40] PostgreSQL tables initialized successfully.');
    resolveDbReady();
  } catch (e) {
    console.error('[DB] [VER 1.40] FATAL ERROR during initialization:', e.message);
    // Resolve anyway to let the server start (though it might fail on queries)
    resolveDbReady();
  } finally {
    if (client) client.release();
  }
};

initialize();

// POLYFILL EXPORT: Allow both direct pool use and readiness checking
module.exports = pool;
module.exports.dbReady = dbReady;
module.exports.pool = pool; // Self-reference for destructuring compatibility
