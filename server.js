require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pool = require('./database');
const { dbReady } = pool;

// Multi-style compatibility check
console.log(`[SERVER] [VER 1.36] Pool type: ${typeof pool} | hasQuery: ${typeof pool.query === 'function'} | hasDbReady: ${typeof pool.dbReady === 'object'}`);

const User = require('./src/models/user');
const Page = require('./src/models/page');
const Revision = require('./src/models/revision');
const Topic = require('./src/models/topic');
const Activity = require('./src/models/activity');
const Favorite = require('./src/models/favorite');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[SERVER] [VER 1.36] Initializing system...');

// Trust proxy
app.set('trust proxy', 1);

// Configure View Engine
const ejs = require('ejs');
app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');
const viewsDir = path.join(__dirname, 'src', 'views');
app.set('views', viewsDir);

console.log(`[SERVER] [VER 1.36] View engine: ${app.get('view engine')} | Views dir: ${app.get('views')}`);

// Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:", "https://unpkg.com"],
            "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            "script-src-attr": ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use(compression());

const limiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 100 });
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src', 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'wiki-ai-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const wikiMiddleware = require('./src/middleware/wiki');

// Shared Data Middleware
const provideWikiData = (req, res, next) => {
    const wikiId = req.wiki ? req.wiki.id : null;
    if (!wikiId) return next();

    Page.getCategories(wikiId, (catErr, categories) => {
        Activity.getRecent(10, wikiId, (actErr, activity) => {
            Topic.getAll(wikiId, (topErr, allTopics) => {
                res.locals.allCategories = categories || [];
                res.locals.recentActivity = activity || [];
                res.locals.allTopics = allTopics || [];
                res.locals.wikiUrl = (path) => {
                    const cleanPath = path.startsWith('/') ? path : '/' + path;
                    return `/w/${req.wiki.slug}${cleanPath}`;
                };

                if (req.session && req.session.userId) {
                    User.findById(req.session.userId, (err, user) => {
                        res.locals.currentUser = user || null;
                        Topic.getFollowedByUser(wikiId, req.session.userId, (fErr, followed) => {
                            Topic.getFavoritesByUser(wikiId, req.session.userId, (favErr, favorites) => {
                                Favorite.getByUser(req.session.userId, (pageFavErr, favoritePages) => {
                                    Page.getDraftsByAuthor(wikiId, req.session.userId, (draftErr, drafts) => {
                                        res.locals.userTopics = followed || [];
                                        res.locals.favoriteTopics = favorites || [];
                                        res.locals.favoritePages = favoritePages || [];
                                        res.locals.userDrafts = drafts || [];
                                        next();
                                    });
                                });
                            });
                        });
                    });
                } else {
                    res.locals.currentUser = null;
                    res.locals.userTopics = res.locals.favoriteTopics = res.locals.favoritePages = res.locals.userDrafts = [];
                    next();
                }
            });
        });
    });
};

// Routes
const wikiRoutes = require('./src/routes/wiki');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');

app.use('/', authRoutes);
app.use('/admin', provideWikiData, adminRoutes);

// System Diagnostic (Hidden)
app.get('/system/check', async (req, res) => {
    try {
        const wikiCount = await pool.query('SELECT count(*) FROM wikis');
        const generalWiki = await pool.query('SELECT * FROM wikis WHERE slug = $1', ['general']);
        res.json({
            version: '1.36',
            status: 'online',
            pool: {
                type: typeof pool,
                hasQuery: typeof pool.query === 'function',
                hasDbReady: typeof pool.dbReady === 'object'
            },
            database: {
                wikiCount: wikiCount.rows[0].count,
                hasGeneral: generalWiki.rows.length > 0,
                generalData: generalWiki.rows[0] || null
            }
        });
    } catch (err) {
        res.status(500).json({ version: '1.36', error: err.message, stack: err.stack });
    }
});

app.get('/', (req, res) => {
    const defaultWiki = process.env.DEFAULT_WIKI_SLUG || 'general';
    console.log(`[SERVER] [VER 1.36] Root redirect -> /w/${defaultWiki}`);
    return res.redirect(`/w/${defaultWiki}`);
});

app.use('/w/:wiki_slug', wikiMiddleware, provideWikiData, wikiRoutes);

// Error Handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR] [VER 1.36]', err.stack);
    const status = err.status || 500;
    try {
        res.status(status).render('error', {
            message: process.env.NODE_ENV === 'production' ? 'Un error interno ha ocurrido.' : err.message,
            status: status
        });
    } catch (renderErr) {
        res.status(status).send(`Error ${status}: ${err.message}`);
    }
});

// START SERVER
dbReady.then(() => {
    console.log('[SERVER] [VER 1.36] Database initialized. Ready for connections.');
    app.listen(PORT, () => {
        console.log(`[SERVER] [VER 1.36] Listening on port ${PORT}`);
    });
}).catch(err => {
    console.error('[SERVER] [VER 1.36] Warning: DB Init encountered errors, but starting anyway.', err.message);
    app.listen(PORT, () => {
        console.log(`[SERVER] [VER 1.36] Listening on port ${PORT} (DEGRADED MODE)`);
    });
});
