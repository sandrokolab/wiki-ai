const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false
});

/**
 * PHASE 1: Create base tables with minimal structure
 */
async function createBaseTables(client) {
  console.log('Phase 1: Creating base tables...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS wikis (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seeding default wiki EARLY in Phase 1 to prevent 404s
  console.log('Phase 1.5: Seeding default wiki "general"...');
  try {
    const insertRes = await client.query(`
      INSERT INTO wikis (name, slug, description)
      VALUES ('Wiki General', 'general', 'Espacio principal de la wiki')
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `);
    if (insertRes.rows.length > 0) {
      console.log(`Default wiki "general" created with ID: ${insertRes.rows[0].id}`);
    } else {
      console.log('Default wiki "general" already exists.');
    }
  } catch (err) {
    console.error('Error seeding general wiki in Phase 1:', err.message);
  }

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
}

/**
 * PHASE 2: Add missing columns (migraciones robustas)
 */
async function addMissingColumns(client) {
  console.log('Phase 2: Verifying and adding missing columns...');
  const migrations = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'user\'',
    'ALTER TABLE topics ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'draft\'',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false',
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true',
    'ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE',
    'ALTER TABLE comments ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE',
    'ALTER TABLE page_revisions ADD COLUMN IF NOT EXISTS change_summary TEXT'
  ];

  for (const sql of migrations) {
    try {
      await client.query(sql);
    } catch (err) {
      // 42701 is "column already exists"
      if (err.code !== '42701') {
        console.warn(`Migration notice (non-critical): ${err.message} [SQL: ${sql}]`);
      }
    }
  }
}

/**
 * PHASE 3: Apply constraints and indexes
 */
async function createIndexesAndConstraints(client) {
  console.log('Phase 3: Applying constraints and indexes...');

  // Clean up broken/orphaned indexes first to avoid conflicts
  const cleanup = [
    'DROP INDEX IF EXISTS idx_pages_wiki_id',
    'DROP INDEX IF EXISTS idx_topics_wiki_id',
    'DROP INDEX IF EXISTS idx_activity_log_wiki_id',
    'DROP INDEX IF EXISTS idx_comments_wiki_id'
  ];
  for (const sql of cleanup) { try { await client.query(sql); } catch (e) { } }

  // Applying definitive constraints
  try {
    await client.query('ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_name_key');
    await client.query('ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_wiki_name_unique');
    await client.query('ALTER TABLE topics ADD CONSTRAINT topics_wiki_name_unique UNIQUE (wiki_id, name)');

    await client.query('ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_key');
    await client.query('ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_wiki_slug_unique');
    await client.query('ALTER TABLE pages ADD CONSTRAINT pages_wiki_slug_unique UNIQUE (wiki_id, slug)');

    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_pages_wiki_id ON pages(wiki_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_topics_wiki_id ON topics(wiki_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_activity_log_wiki_id ON activity_log(wiki_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_comments_wiki_id ON comments(wiki_id)');
  } catch (err) {
    console.error('CRITICAL ERROR in Phase 3:', err.message);
    throw err;
  }
}

/**
 * PHASE 4: Secondary tables and data linking
 */
async function finalizeSetup(client) {
  console.log('Phase 4: Finalizing setup and data linking...');

  const defaultWiki = await client.query("SELECT id FROM wikis WHERE slug = 'general'");
  if (defaultWiki.rows.length > 0) {
    const wikiId = defaultWiki.rows[0].id;
    console.log(`Ensuring orphaned records are linked to wiki ID: ${wikiId}`);
    try {
      await client.query("UPDATE pages SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
      await client.query("UPDATE topics SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
      await client.query("UPDATE activity_log SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
      await client.query("UPDATE comments SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
    } catch (err) {
      console.warn('Update orphaned records non-critical error:', err.message);
    }
  } else {
    console.error('CRITICAL ERROR: Default wiki "general" could not be found in Phase 4.');
  }

  // Secondary tables
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target_id INTEGER,
      page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      reaction_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id, user_id)
    )
  `);

  // Session table for connect-pg-simple
  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    ) WITH (OIDS=FALSE)
  `);
  await client.query('ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey"');
  await client.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE');
  await client.query('CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")');
}

// Main initialization function
const initialize = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await createBaseTables(client);
    await addMissingColumns(client);
    await createIndexesAndConstraints(client);
    await finalizeSetup(client);

    await client.query('COMMIT');
    console.log('Database initialized successfully.');
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL tables:', e);
  } finally {
    if (client) client.release();
  }
};

initialize();

module.exports = pool;
