const pool = require('../../database');

class Reaction {
    static async addOrUpdate(commentId, userId, reactionType, callback) {
        try {
            const sql = `
                INSERT INTO comment_reactions (comment_id, user_id, reaction_type) 
                VALUES ($1, $2, $3) 
                ON CONFLICT (comment_id, user_id) 
                DO UPDATE SET reaction_type = EXCLUDED.reaction_type
            `;
            const res = await pool.query(sql, [commentId, userId, reactionType]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async remove(commentId, userId, callback) {
        try {
            const sql = 'DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2';
            const res = await pool.query(sql, [commentId, userId]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async getCountsByComment(commentId, callback) {
        try {
            const sql = `
                SELECT reaction_type, COUNT(*) as count 
                FROM comment_reactions 
                WHERE comment_id = $1 
                GROUP BY reaction_type
            `;
            const res = await pool.query(sql, [commentId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getUserReactionsOnPage(pageId, userId, callback) {
        try {
            const sql = `
                SELECT cr.comment_id, cr.reaction_type 
                FROM comment_reactions cr 
                JOIN comments c ON cr.comment_id = c.id 
                WHERE c.page_id = $1 AND cr.user_id = $2
            `;
            const res = await pool.query(sql, [pageId, userId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Reaction;
