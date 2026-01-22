const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: (process.env.DATABASE_URL || process.env.DB_URL) ? { rejectUnauthorized: false } : false
});

// Initialize tables for PostgreSQL
const initialize = async () => {
  const client = await pool.connect();
  try {
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
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE,
        title TEXT,
        content TEXT,
        category TEXT,
        author_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_revisions (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id),
        content TEXT,
        author_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL tables initialized.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL tables:', e);
  } finally {
    client.release();
  }
};

initialize();

module.exports = pool;
