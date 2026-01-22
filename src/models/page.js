const pool = require('../../database');

class Page {
    static async create(title, slug, content, authorId, category, callback) {
        if (typeof category === 'function') {
            callback = category;
            category = null;
        }
        try {
            const sql = 'INSERT INTO pages (title, slug, content, author_id, category) VALUES ($1, $2, $3, $4, $5) RETURNING id';
            const res = await pool.query(sql, [title, slug, content, authorId, category]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getBySlug(slug, callback) {
        try {
            const sql = 'SELECT * FROM pages WHERE slug = $1';
            const res = await pool.query(sql, [slug]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getByTitle(title, callback) {
        try {
            const sql = 'SELECT * FROM pages WHERE title = $1';
            const res = await pool.query(sql, [title]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getBacklinks(title, callback) {
        try {
            const pattern = `%[[${title}]]%`;
            const sql = 'SELECT title, slug FROM pages WHERE content LIKE $1';
            const res = await pool.query(sql, [pattern]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getAll(callback) {
        try {
            const sql = 'SELECT * FROM pages ORDER BY created_at DESC';
            const res = await pool.query(sql);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async search(query, callback) {
        try {
            const pattern = `%${query}%`;
            const sql = 'SELECT title, slug, content FROM pages WHERE title ILIKE $1 OR content ILIKE $1';
            const res = await pool.query(sql, [pattern]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getCategories(callback) {
        try {
            const sql = "SELECT DISTINCT category FROM pages WHERE category IS NOT NULL AND category != '' ORDER BY category ASC";
            const res = await pool.query(sql);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getByCategory(category, callback) {
        try {
            const sql = 'SELECT title, slug FROM pages WHERE category = $1 ORDER BY title ASC';
            const res = await pool.query(sql, [category]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getAlphabeticalIndex(callback) {
        try {
            const sql = 'SELECT title, slug FROM pages ORDER BY title ASC';
            const res = await pool.query(sql);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async update(slug, title, newSlug, content, authorId, category, callback) {
        if (typeof category === 'function') {
            callback = category;
            category = null;
        }
        try {
            const sql = 'UPDATE pages SET title = $1, slug = $2, content = $3, category = $4, author_id = $5, updated_at = CURRENT_TIMESTAMP WHERE slug = $6';
            const res = await pool.query(sql, [title, newSlug, content, category, authorId, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Page;
