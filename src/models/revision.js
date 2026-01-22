const pool = require('../../database');

class Revision {
    static async create(pageId, content, authorId, callback) {
        try {
            const sql = 'INSERT INTO page_revisions (page_id, content, author_id) VALUES ($1, $2, $3) RETURNING id';
            const res = await pool.query(sql, [pageId, content, authorId]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getByPageId(pageId, callback) {
        try {
            const sql = `
        SELECT r.*, u.username 
        FROM page_revisions r 
        LEFT JOIN users u ON r.author_id = u.id 
        WHERE r.page_id = $1 
        ORDER BY r.created_at DESC
      `;
            const res = await pool.query(sql, [pageId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getById(id, callback) {
        try {
            const sql = `
        SELECT r.*, p.title, p.slug 
        FROM page_revisions r 
        JOIN pages p ON r.page_id = p.id 
        WHERE r.id = $1
      `;
            const res = await pool.query(sql, [id]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getRecentActivity(limit, callback) {
        try {
            const sql = `
                SELECT r.created_at, u.username, p.title, p.slug, r.content, p.category
                FROM page_revisions r
                JOIN pages p ON r.page_id = p.id
                JOIN users u ON r.author_id = u.id
                ORDER BY r.created_at DESC
                LIMIT $1
            `;
            const res = await pool.query(sql, [limit]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Revision;
