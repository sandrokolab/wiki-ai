const pool = require('../../database');

class Comment {
    static async create(pageId, userId, content, callback) {
        try {
            const sql = 'INSERT INTO comments (page_id, user_id, content) VALUES ($1, $2, $3) RETURNING id';
            const res = await pool.query(sql, [pageId, userId, content]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getByPageId(pageId, callback) {
        try {
            const sql = `
                SELECT c.*, u.username, u.email 
                FROM comments c 
                JOIN users u ON c.user_id = u.id 
                WHERE c.page_id = $1 
                ORDER BY c.created_at ASC
            `;
            const res = await pool.query(sql, [pageId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async delete(commentId, userId, callback) {
        try {
            const sql = 'DELETE FROM comments WHERE id = $1 AND user_id = $2';
            const res = await pool.query(sql, [commentId, userId]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Comment;
