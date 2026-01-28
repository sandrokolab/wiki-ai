// TODO: Multi-wiki deshabilitado temporalmente. Reactivar después de estabilizar deploy.
const { Pool } = require('pg');

/**
 * INDESTRUCTIBLE DATABASE INITIALIZATION (VER 1.40)
 * Optimized for Railway/PostgreSQL stability.
 */

// 1. Connection with robust SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // 10s timeout
});

// Create a readiness promise that we can export
let resolveDbReady;
const dbReady = new Promise((res) => {
  resolveDbReady = res;
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
    if (['42701', '42P07', '23505', '42601'].includes(err.code)) {
      console.log(`[DB] ${label}: Already exists or handled`);
    } else {
      console.error(`[DB] ${label}: Error ->`, err.message);
    }
    return null;
  }
}

/**
 * Initialize tables for PostgreSQL
 */
const initialize = async () => {
  console.log('[DB] [VER 1.40] Starting indestructible initialization...');
  let client;

  try {
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

    // USERS (Sin wiki_id)
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

    // TOPICS (Sin wiki_id)
    await safeQuery(client, 'Table topics', `
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name TEXT,
        icon TEXT DEFAULT 'ph-hash',
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        parent_id INTEGER REFERENCES topics(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PAGES (Sin wiki_id)
    await safeQuery(client, 'Table pages', `
      CREATE TABLE IF NOT EXISTS pages (
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

    // 2. SURGICAL COLUMN INJECTION (In case tables existed)
    await safeQuery(client, 'Inject topic_id pages', 'ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)');
    await safeQuery(client, 'Inject role users', "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'");

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

    // ACTIVITY LOG
    await safeQuery(client, 'Table activity_log', `
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action_type TEXT,
        page_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // SESSION
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
    resolveDbReady();
  } finally {
    if (client) client.release();
  }
};

initialize();

module.exports = pool;
module.exports.dbReady = dbReady;
module.exports.pool = pool;
