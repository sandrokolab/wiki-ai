const { Pool } = require('pg');

console.log('--- Database Initialization ---');
console.log('Available Env Vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('URL') || k.includes('PG')));
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 15) + '...');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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
