const pool = require('../../database');

class Notification {
    static async create(userId, actorId, type, targetId, pageId, callback) {
        try {
            const sql = 'INSERT INTO notifications (user_id, actor_id, type, target_id, page_id) VALUES ($1, $2, $3, $4, $5) RETURNING id';
            const res = await pool.query(sql, [userId, actorId, type, targetId, pageId]);
            if (callback) callback(null, res.rows[0].id);
        } catch (err) {
            if (callback) callback(err);
        }
    }

    static async getByUser(userId, callback) {
        try {
            const sql = `
                SELECT n.*, u.username as actor_name, p.title as page_title, p.slug as page_slug 
                FROM notifications n 
                JOIN users u ON n.actor_id = u.id 
                LEFT JOIN pages p ON n.page_id = p.id 
                WHERE n.user_id = $1 
                ORDER BY n.created_at DESC 
                LIMIT 20
            `;
            const res = await pool.query(sql, [userId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getUnreadCount(userId, callback) {
        try {
            const sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false';
            const res = await pool.query(sql, [userId]);
            callback(null, parseInt(res.rows[0].count));
        } catch (err) {
            callback(err);
        }
    }

    static async markAsRead(id, callback) {
        try {
            const sql = 'UPDATE notifications SET is_read = true WHERE id = $1';
            const res = await pool.query(sql, [id]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async markAllAsRead(userId, callback) {
        try {
            const sql = 'UPDATE notifications SET is_read = true WHERE user_id = $1';
            const res = await pool.query(sql, [userId]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Notification;
