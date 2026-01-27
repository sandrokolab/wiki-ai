const pool = require('../../database');

class Page {
    static async create(wikiId, title, slug, content, authorId, category, topicId, status, allowComments, callback) {
        try {
            const sql = 'INSERT INTO pages (wiki_id, title, slug, content, author_id, category, topic_id, status, allow_comments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id';
            const res = await pool.query(sql, [wikiId, title, slug, content, authorId, category || null, topicId || null, status || 'draft', allowComments === undefined ? true : allowComments]);
            callback(null, res.rows[0].id);
        } catch (err) {
            callback(err);
        }
    }

    static async getBySlug(wikiId, slug, callback) {
        try {
            const sql = 'SELECT p.*, t.name as topic_name, t.icon as topic_icon, t.color as topic_color FROM pages p LEFT JOIN topics t ON p.topic_id = t.id WHERE p.wiki_id = $1 AND p.slug = $2';
            const res = await pool.query(sql, [wikiId, slug]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getByTitle(wikiId, title, callback) {
        try {
            const sql = 'SELECT * FROM pages WHERE wiki_id = $1 AND title = $2';
            const res = await pool.query(sql, [wikiId, title]);
            callback(null, res.rows[0]);
        } catch (err) {
            callback(err);
        }
    }

    static async getBacklinks(wikiId, title, callback) {
        try {
            const pattern = `%[[${title}]]%`;
            const sql = 'SELECT title, slug FROM pages WHERE wiki_id = $1 AND content LIKE $2';
            const res = await pool.query(sql, [wikiId, pattern]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getAll(wikiId, callback) {
        try {
            const sql = "SELECT * FROM pages WHERE wiki_id = $1 AND status = 'published' ORDER BY created_at DESC";
            const res = await pool.query(sql, [wikiId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getDraftsByAuthor(wikiId, authorId, callback) {
        try {
            const sql = "SELECT * FROM pages WHERE wiki_id = $1 AND author_id = $2 AND status = 'draft' ORDER BY updated_at DESC";
            const res = await pool.query(sql, [wikiId, authorId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async search(wikiId, query, filters = {}, callback) {
        try {
            const pattern = `%${query}%`;
            let params = [wikiId, pattern];
            let pageFilters = ["p.wiki_id = $1", "(p.title ILIKE $2 OR p.content ILIKE $2) AND p.status = 'published'"];
            let commentFilters = ["p.wiki_id = $1", "c.content ILIKE $2"];

            if (filters.topicId) {
                params.push(filters.topicId);
                pageFilters.push(`p.topic_id = $${params.length}`);
                commentFilters.push(`p.topic_id = $${params.length}`);
            }

            if (filters.category) {
                params.push(filters.category);
                pageFilters.push(`p.category = $${params.length}`);
                commentFilters.push(`p.category = $${params.length}`);
            }

            if (filters.authorId) {
                params.push(filters.authorId);
                pageFilters.push(`p.author_id = $${params.length}`);
                commentFilters.push(`c.user_id = $${params.length}`);
            }

            if (filters.dateRange) {
                let interval = '';
                if (filters.dateRange === 'today') interval = '1 day';
                else if (filters.dateRange === 'week') interval = '7 days';
                else if (filters.dateRange === 'month') interval = '30 days';

                if (interval) {
                    pageFilters.push(`p.created_at >= CURRENT_TIMESTAMP - INTERVAL '${interval}'`);
                    commentFilters.push(`c.created_at >= CURRENT_TIMESTAMP - INTERVAL '${interval}'`);
                }
            }

            const sql = `
                SELECT 'page' as type, p.title, p.slug, p.content 
                FROM pages p
                WHERE ${pageFilters.join(' AND ')}
                UNION
                SELECT 'comment' as type, p.title, p.slug, c.content 
                FROM comments c
                JOIN pages p ON c.page_id = p.id
                WHERE ${commentFilters.join(' AND ')}
                ORDER BY type ASC, title ASC
            `;
            const res = await pool.query(sql, params);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getCategories(wikiId, callback) {
        try {
            const sql = "SELECT DISTINCT category FROM pages WHERE wiki_id = $1 AND category IS NOT NULL AND category != '' ORDER BY category ASC";
            const res = await pool.query(sql, [wikiId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getByCategory(wikiId, category, callback) {
        try {
            const sql = `
                SELECT p.title, p.slug 
                FROM pages p 
                LEFT JOIN topics t ON p.topic_id = t.id 
                WHERE p.wiki_id = $1 AND (p.category = $2 OR t.name = $2) 
                ORDER BY p.title ASC
            `;
            const res = await pool.query(sql, [wikiId, category]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async getAlphabeticalIndex(wikiId, callback) {
        try {
            const sql = 'SELECT title, slug FROM pages WHERE wiki_id = $1 ORDER BY title ASC';
            const res = await pool.query(sql, [wikiId]);
            callback(null, res.rows);
        } catch (err) {
            callback(err);
        }
    }

    static async update(wikiId, slug, title, newSlug, content, authorId, category, topicId, status, allowComments, callback) {
        try {
            const sql = 'UPDATE pages SET title = $1, slug = $2, content = $3, category = $4, author_id = $5, topic_id = $6, status = $7, allow_comments = $8, updated_at = CURRENT_TIMESTAMP WHERE wiki_id = $9 AND slug = $10';
            const res = await pool.query(sql, [title, newSlug, content, category || null, authorId, topicId || null, status || 'published', allowComments === undefined ? true : allowComments, wikiId, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async publish(wikiId, slug, callback) {
        try {
            const sql = "UPDATE pages SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE wiki_id = $1 AND slug = $2";
            const res = await pool.query(sql, [wikiId, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async verify(wikiId, slug, isVerified, callback) {
        try {
            const sql = "UPDATE pages SET is_verified = $1, updated_at = CURRENT_TIMESTAMP WHERE wiki_id = $2 AND slug = $3";
            const res = await pool.query(sql, [isVerified, wikiId, slug]);
            callback(null, res.rowCount);
        } catch (err) {
            callback(err);
        }
    }

    static async getCount() {
        const res = await pool.query('SELECT COUNT(*) FROM pages');
        return parseInt(res.rows[0].count);
    }

    static async getAllGlobal() {
        const sql = `
            SELECT p.*, w.slug as wiki_slug, w.name as wiki_name, u.username as author_name 
            FROM pages p
            JOIN wikis w ON p.wiki_id = w.id
            LEFT JOIN users u ON p.author_id = u.id
            ORDER BY p.created_at DESC
        `;
        const res = await pool.query(sql);
        return res.rows;
    }
}

module.exports = Page;
