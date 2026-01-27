const pool = require('../../database');

class Activity {
    static async log(userId, actionType, pageId, metadata, wikiId, callback) {
        try {
            const sql = 'INSERT INTO activity_log (user_id, action_type, page_id, metadata, wiki_id) VALUES ($1, $2, $3, $4, $5) RETURNING id';
            const res = await pool.query(sql, [userId, actionType, pageId, metadata ? JSON.stringify(metadata) : null, wikiId]);
            if (callback) callback(null, res.rows[0].id);
        } catch (err) {
            if (callback) callback(err);
        }
    }

    static async getRecent(limit = 20, wikiId, callback) {
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
                WHERE a.wiki_id = $2
                ORDER BY a.created_at DESC
                LIMIT $1
            `;
            const res = await pool.query(sql, [limit, wikiId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}


module.exports = Activity;
