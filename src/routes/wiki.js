const express = require('express');
const router = express.Router();
const Page = require('../models/page');
const Revision = require('../models/revision');
const User = require('../models/user');
const Topic = require('../models/topic');
const Activity = require('../models/activity');
const isAuthenticated = require('../middleware/auth');
const marked = require('marked');
const diff = require('diff');
const xss = require('xss');

// Helper to replace [[WikiLinks]] with HTML anchor tags
async function processWikiLinks(content) {
    const regex = /\[\[(.*?)\]\]/g;
    const matches = [...content.matchAll(regex)];
    let processedContent = content;

    for (const match of matches) {
        const fullMatch = match[0];
        const pageTitle = match[1];

        // Find if page exists by title
        const page = await new Promise((resolve) => {
            Page.getByTitle(pageTitle, (err, row) => resolve(row));
        });

        if (page) {
            processedContent = processedContent.replace(
                fullMatch,
                `<a href="/wiki/${page.slug}" class="wiki-link-exists">${pageTitle}</a>`
            );
        } else {
            const encodedTitle = encodeURIComponent(pageTitle);
            processedContent = processedContent.replace(
                fullMatch,
                `<a href="/create?title=${encodedTitle}" class="wiki-link-new">${pageTitle}</a>`
            );
        }
    }
    return processedContent;
}

// Home route - List all pages
router.get('/', (req, res) => {
    Page.getAll((err, pages) => {
        if (err) return res.status(500).send('Database error');
        res.render('index', {
            pages,
            viewedPages: req.session.viewedPages || []
        });
    });
});

// Search route
router.get('/search', (req, res) => {
    const query = req.query.q;
    if (!query) return res.redirect('/');

    Page.search(query, (err, results) => {
        if (err) return res.status(500).send('Search error');
        res.render('search', { query, results });
    });
});

// Alphabetical Index
router.get('/indice', (req, res) => {
    Page.getAlphabeticalIndex((err, pages) => {
        if (err) return res.status(500).send('Error');
        res.render('index_list', { pages });
    });
});

// List all categories
router.get('/categorias', (req, res) => {
    Page.getCategories((err, categories) => {
        if (err) return res.status(500).send('Error');
        res.render('categories', { categories });
    });
});

// List pages in a category
router.get('/categoria/:name', (req, res) => {
    const category = req.params.name;
    Page.getByCategory(category, (err, pages) => {
        if (err) return res.status(500).send('Error');
        res.render('category_pages', { category, pages });
    });
});

// Create page route (form)
router.get('/create', isAuthenticated, (req, res) => {
    const title = req.query.title || '';
    res.render('create', { prefilledTitle: title });
});

// Create page submit
router.post('/create', isAuthenticated, (req, res) => {
    let { title, slug, content, category, topic_id } = req.body;
    const userId = req.session.userId;

    // XSS Sanitization
    title = xss(title);
    content = xss(content);
    category = xss(category);

    Page.create(title, slug, content, userId, category, topic_id || null, (err, id) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error creating page');
        }
        Activity.log(userId, 'published', id, { title, slug });
        res.redirect(`/wiki/${slug}`);
    });
});

// View page route
router.get('/wiki/:slug', (req, res) => {
    const slug = req.params.slug;
    Page.getBySlug(slug, (err, page) => {
        if (err) return res.status(500).send('Database error');
        if (!page) return res.status(404).send('Page not found');

        // Convert markdown to HTML
        const parsed = marked.parse(page.content);

        // Handle async marked.parse or simple string
        const handleHtml = async (html) => {
            // Process [[WikiLinks]]
            const contentWithLinks = await processWikiLinks(html);
            page.htmlContent = contentWithLinks;

            // Fetch Backlinks
            Page.getBacklinks(page.title, (backErr, backlinks) => {
                page.backlinks = backlinks || [];

                // Update Recently Viewed in Session
                if (!req.session.viewedPages) req.session.viewedPages = [];
                const currentPage = {
                    title: page.title,
                    slug: page.slug,
                    category: page.category,
                    timestamp: new Date()
                };

                // Remove if already exists to move to top, then unshift and slice
                req.session.viewedPages = req.session.viewedPages.filter(p => p.slug !== page.slug);
                req.session.viewedPages.unshift(currentPage);
                req.session.viewedPages = req.session.viewedPages.slice(0, 5); // Keep last 5

                res.render('page', { page });
            });
        };

        if (parsed instanceof Promise) {
            parsed.then(handleHtml);
        } else {
            handleHtml(parsed);
        }
    });
});

// Edit page route (form)
router.get('/wiki/:slug/edit', isAuthenticated, (req, res) => {
    const slug = req.params.slug;
    Page.getBySlug(slug, (err, page) => {
        if (err) return res.status(500).send('Database error');
        if (!page) return res.status(404).send('Page not found');
        res.render('edit', { page });
    });
});

// Edit page submit
router.post('/wiki/:slug/edit', isAuthenticated, (req, res) => {
    const oldSlug = req.params.slug;
    let { title, slug, content, category, topic_id } = req.body;
    const userId = req.session.userId;

    // XSS Sanitization
    title = xss(title);
    content = xss(content);
    category = xss(category);

    Page.getBySlug(oldSlug, (err, page) => {
        if (err || !page) return res.status(500).send('Error fetching page');

        // Save current as revision
        Revision.create(page.id, page.content, userId, (revErr) => {
            Page.update(oldSlug, title, slug, content, userId, category, topic_id || null, (upErr) => {
                if (upErr) return res.status(500).send('Update failed');
                Activity.log(userId, 'edited', page.id, { title, slug });
                res.redirect(`/wiki/${slug}`);
            });
        });
    });
});

// Page History
router.get('/wiki/:slug/history', (req, res) => {
    const slug = req.params.slug;
    Page.getBySlug(slug, (err, page) => {
        if (err || !page) return res.status(500).send('Error fetching page');

        Revision.getByPageId(page.id, (revErr, revisions) => {
            if (revErr) return res.status(500).send('Error fetching history');
            res.render('history', { page, revisions });
        });
    });
});

// View old version
router.get('/wiki/:slug/v/:revisionId', (req, res) => {
    const revisionId = req.params.revisionId;
    Revision.getById(revisionId, (err, revision) => {
        if (err || !revision) return res.status(404).send('Revision not found');

        const parsed = marked.parse(revision.content);

        const handleHtml = async (html) => {
            revision.htmlContent = await processWikiLinks(html);
            res.render('version', { revision });
        };

        if (parsed instanceof Promise) {
            parsed.then(handleHtml);
        } else {
            handleHtml(parsed);
        }
    });
});

// Revert to old version
router.post('/wiki/:slug/v/:revisionId/revert', isAuthenticated, (req, res) => {
    const slug = req.params.slug;
    const revisionId = req.params.revisionId;
    const userId = req.session.userId;

    Revision.getById(revisionId, (err, revision) => {
        if (err || !revision) return res.status(404).send('Revision not found');

        Page.getBySlug(slug, (pErr, page) => {
            if (pErr || !page) return res.status(500).send('Page error');

            // Save current as revision before revert
            Revision.create(page.id, page.content, userId, () => {
                Page.update(slug, revision.title, revision.slug, revision.content, userId, revision.category, (uErr) => {
                    if (uErr) return res.status(500).send('Revert failed');
                    res.redirect(`/wiki/${revision.slug}`);
                });
            });
        });
    });
});

// Diff view
router.get('/wiki/:slug/v/:revisionId/diff', (req, res) => {
    const revisionId = req.params.revisionId;
    const slug = req.params.slug;

    Revision.getById(revisionId, (err, revision) => {
        if (err || !revision) return res.status(404).send('Revision not found');

        Page.getBySlug(slug, (pErr, page) => {
            if (pErr || !page) return res.status(500).send('Page error');

            const changes = diff.diffLines(revision.content, page.content);
            res.render('diff', { page, revision, changes });
        });
    });
});

// Profile page
router.get('/profile/:username', (req, res) => {
    const username = req.params.username;
    User.findByUsername(username, (err, user) => {
        if (err || !user) return res.status(404).send('User not found');
        res.render('profile', { user });
    });
});

// Create Topic
router.post('/topics/create', isAuthenticated, (req, res) => {
    let { name, icon, color, description, parentId } = req.body;
    name = xss(name);
    description = xss(description);

    Topic.create(name, icon, color, description, parentId || null, (err, id) => {
        if (err) return res.status(500).json({ error: 'Failed to create topic' });
        res.json({ id, name });
    });
});

// Follow Topic
router.post('/topics/:id/follow', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const topicId = req.params.id;
    Topic.follow(userId, topicId, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to follow' });
        res.json({ success: true });
    });
});

// Favorite Topic
router.post('/topics/:id/favorite', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const topicId = req.params.id;
    Topic.favorite(userId, topicId, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to favorite' });
        res.json({ success: true });
    });
});

// API Search (Grouped results)
router.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json({ pages: [], topics: [], users: [] });

    Page.search(query, (pErr, pages) => {
        Topic.search(query, (tErr, topics) => {
            User.search(query, (uErr, users) => {
                res.json({
                    pages: pages || [],
                    topics: topics || [],
                    users: users || []
                });
            });
        });
    });
});

// API Activity (Recent feed)
router.get('/api/activity', (req, res) => {
    Activity.getRecent(20, (err, activity) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(activity);
    });
});

module.exports = router;
