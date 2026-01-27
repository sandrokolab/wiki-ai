const pool = require('../../database');

class Page {
    static async create(title, slug, content, authorId, category, topicId, status, allowComments, callback) {
        try {
            const sql = 'INSERT INTO pages (title, slug, content, author_id, category, topic_id, status, allow_comments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
            const res = await pool.query(sql, [title, slug, content, authorId, category || null, topicId || null, status || 'draft', allowComments === undefined ? true : allowComments]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getBySlug(slug, callback) {
        try {
            const sql = 'SELECT p.*, t.name as topic_name, t.icon as topic_icon, t.color as topic_color FROM pages p LEFT JOIN topics t ON p.topic_id = t.id WHERE p.slug = $1';
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
            const sql = "SELECT * FROM pages WHERE status = 'published' ORDER BY created_at DESC";
            const res = await pool.query(sql);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getDraftsByAuthor(authorId, callback) {
        try {
            const sql = "SELECT * FROM pages WHERE author_id = $1 AND status = 'draft' ORDER BY updated_at DESC";
            const res = await pool.query(sql, [authorId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async search(query, callback) {
        try {
            const pattern = `%${query}%`;
            const sql = "SELECT title, slug, content FROM pages WHERE (title ILIKE $1 OR content ILIKE $1) AND status = 'published'";
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
            // Join with topics to also find pages associated with a topic of that name
            const sql = `
                SELECT p.title, p.slug 
                FROM pages p 
                LEFT JOIN topics t ON p.topic_id = t.id 
                WHERE p.category = $1 OR t.name = $1 
                ORDER BY p.title ASC
            `;
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

    static async update(slug, title, newSlug, content, authorId, category, topicId, status, allowComments, callback) {
        try {
            const sql = 'UPDATE pages SET title = $1, slug = $2, content = $3, category = $4, author_id = $5, topic_id = $6, status = $7, allow_comments = $8, updated_at = CURRENT_TIMESTAMP WHERE slug = $9';
            const res = await pool.query(sql, [title, newSlug, content, category || null, authorId, topicId || null, status || 'published', allowComments === undefined ? true : allowComments, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async publish(slug, callback) {
        try {
            const sql = "UPDATE pages SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE slug = $1";
            const res = await pool.query(sql, [slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async verify(slug, isVerified, callback) {
        try {
            const sql = "UPDATE pages SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2";
            const res = await pool.query(sql, [isVerified, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Page;
