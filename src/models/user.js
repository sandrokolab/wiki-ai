const pool = require('../../database');
const bcrypt = require('bcrypt');

class User {
    static async create(username, email, password, callback) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id';
            const res = await pool.query(sql, [username, email, hashedPassword]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async findByUsername(username, callback) {
        try {
            const sql = 'SELECT * FROM users WHERE username = $1';
            const res = await pool.query(sql, [username]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async findById(id, callback) {
        try {
            const sql = 'SELECT * FROM users WHERE id = $1';
            const res = await pool.query(sql, [id]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async search(query, callback) {
        try {
            const pattern = `%${query}%`;
            const sql = 'SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 5';
            const res = await pool.query(sql, [pattern]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getCount() {
        const res = await pool.query('SELECT COUNT(*) FROM users');
        return parseInt(res.rows[0].count);
    }

    static async getAll() {
        const res = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY username ASC');
        return res.rows;
    }
}

module.exports = User;
