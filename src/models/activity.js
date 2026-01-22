const pool = require('../../database');

class Activity {
    static async log(userId, actionType, pageId, metadata, callback) {
        try {
            const sql = 'INSERT INTO activity_log (user_id, action_type, page_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id';
            const res = await pool.query(sql, [userId, actionType, pageId, metadata ? JSON.stringify(metadata) : null]);
            if (callback) callback(null, res.rows[0].id);
        } catch (err) {
            if (callback) callback(err);
        }
    }

    static async getRecent(limit = 20, callback) {
        try {
            const sql = `
                SELECT 
                    a.*, 
                    u.username, 
                    p.title, 
                    p.slug, 
                    p.content,
                    t.name as topic_name,
                    t.color as topic_color
                FROM activity_log a
                JOIN users u ON a.user_id = u.id
                LEFT JOIN pages p ON a.page_id = p.id
                LEFT JOIN topics t ON p.topic_id = t.id
                ORDER BY a.created_at DESC
                LIMIT $1
            `;
            const res = await pool.query(sql, [limit]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Activity;
