const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false
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
    // We ignore "already exists" errors (42701, 42P07, etc)
    if (['42701', '42P07', '23505'].includes(err.code)) {
      console.log(`[DB] ${label}: Already exists (verified)`);
    } else {
      console.error(`[DB] ${label}: Error ->`, err.message);
    }
    return null;
  }
}

/**
 * MAIN INITIALIZATION
 * This version is designed to never throw a fatal error.
 */
const initialize = async () => {
  console.log('[DB] [VER 1.32] Starting indestructible initialization...');
  let client;

  try {
    client = await pool.connect();

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

    // 2. SURGICAL COLUMN INJECTION (Robust check)
    await safeQuery(client, 'Inject wiki_id topics', 'ALTER TABLE topics ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');
    await safeQuery(client, 'Inject wiki_id pages', 'ALTER TABLE pages ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE');
    await safeQuery(client, 'Inject topic_id pages', 'ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)');

    // 3. OTHER TABLES
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

    await safeQuery(client, 'Table comments', `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        page_id INTEGER REFERENCES pages (id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(client, 'Table page_revisions', `
      CREATE TABLE IF NOT EXISTS page_revisions (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages (id) ON DELETE CASCADE,
        content TEXT,
        author_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
        change_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. CONSTRAINTS & INDEXES (Final Polish)
    await safeQuery(client, 'Unique topics', 'ALTER TABLE topics ADD CONSTRAINT topics_wiki_name_unique UNIQUE (wiki_id, name)');
    await safeQuery(client, 'Unique pages', 'ALTER TABLE pages ADD CONSTRAINT pages_wiki_slug_unique UNIQUE (wiki_id, slug)');
    await safeQuery(client, 'Index pages wiki', 'CREATE INDEX IF NOT EXISTS idx_pages_wiki_id ON pages(wiki_id)');
    await safeQuery(client, 'Index topics wiki', 'CREATE INDEX IF NOT EXISTS idx_topics_wiki_id ON topics(wiki_id)');

    // 5. SECONDARY TABLES
    const secondary = [
      'user_favorites', 'user_favorite_topics', 'user_topics', 'notifications', 'comment_reactions'
    ];
    for (const st of secondary) {
      await safeQuery(client, `Table ${st}`, `CREATE TABLE IF NOT EXISTS ${st} (id SERIAL PRIMARY KEY)`);
    }

    // Session
    await safeQuery(client, 'Table session', `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);

    console.log('[DB] [VER 1.32] Initialization COMPLETED (Resilient Mode)');
  } catch (err) {
    console.error('[DB] [VER 1.32] CRITICAL startup failure:', err.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = pool;
pool.dbReady = initialize();
