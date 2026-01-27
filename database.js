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
      CREATE TABLE IF NOT EXISTS wikis (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure at least one default wiki exists
    await client.query(`
      INSERT INTO wikis (name, slug, description)
      VALUES ('Wiki General', 'general', 'Espacio principal de la wiki')
      ON CONFLICT (slug) DO NOTHING
    `);

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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name TEXT,
        icon TEXT DEFAULT 'ph-hash',
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        parent_id INTEGER REFERENCES topics(id),
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (wiki_id, name)
      )
    `);
    await client.query(`ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_name_key`);
    await client.query(`ALTER TABLE topics ADD CONSTRAINT topics_wiki_name_unique UNIQUE (wiki_id, name)`);
    await client.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pages(
        id SERIAL PRIMARY KEY,
        slug TEXT,
        title TEXT,
        content TEXT,
        category TEXT,
        topic_id INTEGER REFERENCES topics(id),
        author_id INTEGER REFERENCES users(id),
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'draft',
        is_verified BOOLEAN DEFAULT false,
        allow_comments BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (wiki_id, slug)
      )
    `);

    // Migrations for existing pages table
    await client.query(`ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_key`);
    await client.query(`ALTER TABLE pages ADD CONSTRAINT pages_wiki_slug_unique UNIQUE (wiki_id, slug)`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id)`);
    await client.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true`);

    // Set default wiki_id for orphan pages/topics
    const defaultWiki = await client.query("SELECT id FROM wikis WHERE slug = 'general'");
    if (defaultWiki.rows.length > 0) {
      const wikiId = defaultWiki.rows[0].id;
      await client.query("UPDATE pages SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
      await client.query("UPDATE topics SET wiki_id = $1 WHERE wiki_id IS NULL", [wikiId]);
    }

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
        wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS wiki_id INTEGER REFERENCES wikis(id) ON DELETE CASCADE`);


    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        attachment_name TEXT,
        attachment_url TEXT,
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
