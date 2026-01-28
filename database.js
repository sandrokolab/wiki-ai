const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false
});

/**
 * HELPER: Ensure column exists
 */
async function ensureColumn(client, table, column, definition) {
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2
  `, [table, column]);

  if (res.rows.length === 0) {
    console.log(`[DB] [SURGERY] Table "${table}" missing column "${column}". Injecting...`);
    await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * PHASE 1: Base Structure & Surgical Repair
 */
async function createBaseTables(client) {
  console.log('[DB] [VER 1.31] Phase 1: Base Tables & Surgery...');

  // 1. Core: wikis
  await client.query(`
    CREATE TABLE IF NOT EXISTS wikis (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. IMMEDIATE SEEDING: Wiki General
  console.log('[DB] Phase 1.1: Seeding "general" wiki...');
  await client.query(`
    INSERT INTO wikis (name, slug, description)
    VALUES ('Wiki General', 'general', 'Espacio principal de la wiki')
    ON CONFLICT (slug) DO NOTHING
  `);

  // 3. Surgery: Ensure wiki_id exists for tables that might be old
  const tablesNeedingWikiId = ['topics', 'pages', 'activity_log', 'comments'];
  for (const table of tablesNeedingWikiId) {
    await client.query(`CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY)`); // Safety
    await ensureColumn(client, table, 'wiki_id', 'INTEGER REFERENCES wikis(id) ON DELETE CASCADE');
  }

  // 4. Detailed definitions (will only update if table is new)
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS pages(
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

  await ensureColumn(client, 'pages', 'topic_id', 'INTEGER REFERENCES topics(id)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
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
      wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachment_name TEXT,
      attachment_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS page_revisions(
      id SERIAL PRIMARY KEY,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      content TEXT,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      change_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * PHASE 2: Heavy Migrations
 */
async function addMissingColumns(client) {
  console.log('[DB] Phase 2: Heavy Migrations...');
  const migrations = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'user\'',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'draft\'',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true',
    'ALTER TABLE page_revisions ADD COLUMN IF NOT EXISTS change_summary TEXT'
  ];

  for (const sql of migrations) {
    try {
      await client.query(sql);
    } catch (err) {
      if (err.code !== '42701') {
        console.warn(`[DB] Migration notice: ${err.message}`);
      }
    }
  }
}

/**
 * PHASE 3: Constraints & Indexes (Final Polish)
 */
async function createIndexesAndConstraints(client) {
  console.log('[DB] Phase 3: Final polish (Constraints & Indexes)...');

  // Pre-cleanup
  const cleanup = [
    'DROP INDEX IF EXISTS idx_pages_wiki_id',
    'DROP INDEX IF EXISTS idx_topics_wiki_id',
    'DROP INDEX IF EXISTS idx_activity_log_wiki_id',
    'DROP INDEX IF EXISTS idx_comments_wiki_id'
  ];
  for (const sql of cleanup) { try { await client.query(sql); } catch (e) { } }

  try {
    // Unique constraints
    await client.query('ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_name_key');
    await client.query('ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_wiki_name_unique');
    await client.query('ALTER TABLE topics ADD CONSTRAINT topics_wiki_name_unique UNIQUE (wiki_id, name)');

    await client.query('ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_key');
    await client.query('ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_wiki_slug_unique');
    await client.query('ALTER TABLE pages ADD CONSTRAINT pages_wiki_slug_unique UNIQUE (wiki_id, slug)');

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_pages_wiki_id ON pages(wiki_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_topics_wiki_id ON topics(wiki_id)');
  } catch (err) {
    console.error('[DB] Error in Phase 3 constraints:', err.message);
  }
}

/**
 * PHASE 4: Secondary Tables & Linking
 */
async function finalizeSetup(client) {
  console.log('[DB] Phase 4: Finalizing secondary tables...');

  const secondaryTables = [
    `CREATE TABLE IF NOT EXISTS user_favorites(
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, page_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_favorite_topics(
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, topic_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_topics(
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, topic_id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications(
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target_id INTEGER,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS comment_reactions(
      comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      reaction_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(comment_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS "session"(
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    ) WITH(OIDS = FALSE)`
  ];

  for (const sql of secondaryTables) {
    await client.query(sql);
  }

  try {
    await client.query('ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey"');
    await client.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE');
    await client.query('CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")');
  } catch (e) { }

  // Scoped Data Linking (Orphans)
  const defaultWiki = await client.query("SELECT id FROM wikis WHERE slug = 'general'");
  if (defaultWiki.rows.length > 0) {
    const wikiId = defaultWiki.rows[0].id;
    await client.query("UPDATE pages SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]).catch(() => { });
    await client.query("UPDATE topics SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]).catch(() => { });
  }
}

const initialize = async () => {
  console.log('[DB] [VER 1.31] Starting initialization process...');
  const phases = [
    { name: 'Phase 1', fn: createBaseTables },
    { name: 'Phase 2', fn: addMissingColumns },
    { name: 'Phase 3', fn: createIndexesAndConstraints },
    { name: 'Phase 4', fn: finalizeSetup }
  ];

  for (const phase of phases) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await phase.fn(client);
      await client.query('COMMIT');
      console.log(`[DB] ${phase.name} completed successfully.`);
    } catch (e) {
      if (client) await client.query('ROLLBACK');
      console.error(`[DB] CRITICAL ERROR IN ${phase.name}:`, e.message);
      if (phase.name === 'Phase 1') throw e;
    } finally {
      if (client) client.release();
    }
  }
  console.log('[DB] [VER 1.31] Database initialization finished.');
};

module.exports = {
  pool,
  dbReady: initialize()
};
