const pool = require('../../database');

class Topic {
    static async create(wikiId, name, icon, color, description, parentId, callback) {
        try {
            const sql = 'INSERT INTO topics (wiki_id, name, icon, color, description, parent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
            const res = await pool.query(sql, [wikiId, name, icon, color, description, parentId]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getAll(wikiId, callback) {
        try {
            const sql = 'SELECT * FROM topics WHERE wiki_id = $1 ORDER BY name ASC';
            const res = await pool.query(sql, [wikiId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getById(wikiId, id, callback) {
        try {
            const sql = 'SELECT * FROM topics WHERE wiki_id = $1 AND id = $2';
            const res = await pool.query(sql, [wikiId, id]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getFollowedByUser(wikiId, userId, callback) {
        try {
            const sql = `
                SELECT t.* FROM topics t
                JOIN user_topics ut ON t.id = ut.topic_id
                WHERE t.wiki_id = $1 AND ut.user_id = $2
                ORDER BY t.name ASC
            `;
            const res = await pool.query(sql, [wikiId, userId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getFavoritesByUser(wikiId, userId, callback) {
        try {
            const sql = `
                SELECT t.* FROM topics t
                JOIN user_favorite_topics uft ON t.id = uft.topic_id
                WHERE t.wiki_id = $1 AND uft.user_id = $2
                ORDER BY t.name ASC
            `;
            const res = await pool.query(sql, [wikiId, userId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async follow(userId, topicId, callback) {
        try {
            const sql = 'INSERT INTO user_topics (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
            await pool.query(sql, [userId, topicId]);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    static async unfollow(userId, topicId, callback) {
        try {
            const sql = 'DELETE FROM user_topics WHERE user_id = $1 AND topic_id = $2';
            await pool.query(sql, [userId, topicId]);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    static async favorite(userId, topicId, callback) {
        try {
            const sql = 'INSERT INTO user_favorite_topics (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
            await pool.query(sql, [userId, topicId]);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    static async unfavorite(userId, topicId, callback) {
        try {
            const sql = 'DELETE FROM user_favorite_topics WHERE user_id = $1 AND topic_id = $2';
            await pool.query(sql, [userId, topicId]);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    static async search(wikiId, query, callback) {
        try {
            const pattern = `%${query}%`;
            const sql = 'SELECT id, name, icon, color FROM topics WHERE wiki_id = $1 AND (name ILIKE $2 OR description ILIKE $2) LIMIT 5';
            const res = await pool.query(sql, [wikiId, pattern]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Topic;
