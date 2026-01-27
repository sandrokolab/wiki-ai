const pool = require('../../database');

class Wiki {
    static async create(name, slug, description, callback) {
        try {
            const sql = 'INSERT INTO wikis (name, slug, description) VALUES ($1, $2, $3) RETURNING id';
            const res = await pool.query(sql, [name, slug, description]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getBySlug(slug, callback) {
        try {
            const sql = 'SELECT * FROM wikis WHERE slug = $1';
            const res = await pool.query(sql, [slug]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getAll(callback) {
        try {
            const sql = 'SELECT * FROM wikis ORDER BY name ASC';
            const res = await pool.query(sql);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async update(id, name, slug, description, callback) {
        try {
            const sql = 'UPDATE wikis SET name = $1, slug = $2, description = $3 WHERE id = $4';
            const res = await pool.query(sql, [name, slug, description, id]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async delete(id, callback) {
        try {
            const sql = 'DELETE FROM wikis WHERE id = $1';
            const res = await pool.query(sql, [id]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = Wiki;
