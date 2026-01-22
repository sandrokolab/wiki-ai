const pool = require('../../database');

class Favorite {
    static async add(userId, pageId, callback) {
        try {
            const res = await pool.query(
                'INSERT INTO user_favorites (user_id, page_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
                [userId, pageId]
            );
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async remove(userId, pageId, callback) {
        try {
            await pool.query(
                'DELETE FROM user_favorites WHERE user_id = $1 AND page_id = $2',
                [userId, pageId]
            );
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    static async isFavorite(userId, pageId, callback) {
        try {
            const res = await pool.query(
                'SELECT * FROM user_favorites WHERE user_id = $1 AND page_id = $2',
                [userId, pageId]
            );
            callback(null, res.rows.length > 0);
        } catch (err) {
            callback(err);
        }
    }

    static async getByUser(userId, callback) {
        try {
            const res = await pool.query(`
                SELECT p.*, f.created_at as favorited_at, t.name as topic_name, t.color as topic_color
                FROM user_favorites f
                JOIN pages p ON f.page_id = p.id
                LEFT JOIN topics t ON p.topic_id = t.id
                WHERE f.user_id = $1
                ORDER BY f.created_at DESC
            `, [userId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Favorite;
