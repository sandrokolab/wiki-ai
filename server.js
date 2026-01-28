require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pool = require('./database');
const { dbReady } = pool;

// VER 1.40 Log
console.log('[SERVER] [VER 1.40] Initializing Wiki AI Restoration (Multi-Wiki Mode)...');

const User = require('./src/models/user');
const Page = require('./src/models/page');
const Revision = require('./src/models/revision');
const Topic = require('./src/models/topic');
const Activity = require('./src/models/activity');
const Favorite = require('./src/models/favorite');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway/Heroku
app.set('trust proxy', 1);

// Configure View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

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

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP'
});
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

// SHARED DATA MIDDLEWARE (Multi-Wiki Aware)
const provideWikiData = (req, res, next) => {
    const wikiId = req.wiki ? req.wiki.id : 1; // Default to ID 1 if not in wiki context

    // Wiki URL Helper
    res.locals.wikiUrl = (path) => {
        const slug = (req.wiki && req.wiki.slug) || 'general';
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return `/w/${slug}${cleanPath}`;
    };

    Page.getCategories(wikiId, (catErr, categories) => {
        Activity.getRecent(10, wikiId, (actErr, activity) => {
            Topic.getAll(wikiId, (topErr, allTopics) => {
                res.locals.allCategories = categories || [];
                res.locals.recentActivity = activity || [];
                res.locals.allTopics = allTopics || [];
                res.locals.wiki = req.wiki || { id: 1, slug: 'general', name: 'Wiki General' };

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

// DIAGNOSTIC ROUTE
app.get('/system/check', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        const wikiCount = await pool.query('SELECT count(*) FROM wikis');
        res.json({
            status: 'UP',
            version: '1.40',
            db: 'CONNECTED',
            time: result.rows[0].now,
            wikis: wikiCount.rows[0].count
        });
    } catch (e) {
        res.status(500).json({ status: 'ERROR', version: '1.40', db: 'DISCONNECTED', error: e.message });
    }
});

// Root Redirect to Default Wiki
app.get('/', (req, res) => {
    const defaultWiki = process.env.DEFAULT_WIKI_SLUG || 'general';
    return res.redirect(`/w/${defaultWiki}`);
});

app.use('/', provideWikiData, authRoutes);
app.use('/admin', provideWikiData, adminRoutes);
app.use('/w/:wiki_slug', wikiMiddleware, provideWikiData, wikiRoutes);

// Error Handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR] [VER 1.40]', err.stack);
    const status = err.status || 500;
    res.status(status).render('error', {
        message: process.env.NODE_ENV === 'production' ? 'Un error interno ha ocurrido.' : err.message,
        status: status,
        wiki: res.locals.wiki || { slug: 'general' }
    });
});

// START SERVER
dbReady.then(() => {
    app.listen(PORT, () => {
        console.log(`[SERVER] [VER 1.40] RESTORED AND RUNNING on port ${PORT}`);
    });
}).catch(err => {
    console.error('[SERVER] [VER 1.40] DB connection failed, starting in degraded mode.');
    app.listen(PORT, () => {
        console.log(`[SERVER] [VER 1.40] Running on port ${PORT} (DEGRADED)`);
    });
});
