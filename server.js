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
console.log('[SERVER] [VER 1.40] Initializing Wiki AI Restoration (Single Wiki Mode)...');

const User = require('./src/models/user');
const Page = require('./src/models/page');
const Revision = require('./src/models/revision');
const Topic = require('./src/models/topic');
const Activity = require('./src/models/activity');
const Favorite = require('./src/models/favorite');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

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

// Global Middleware (Single Wiki)
app.use((req, res, next) => {
    // Helper to keep templates happy (even in single wiki mode)
    res.locals.wiki = { id: 1, slug: 'general', name: 'Wiki AI' };
    res.locals.wikiUrl = (p) => p.startsWith('/') ? p : '/' + p;

    Page.getCategories((catErr, categories) => {
        Activity.getRecent(10, (actErr, activity) => {
            Topic.getAll((topErr, allTopics) => {
                res.locals.allCategories = categories || [];
                res.locals.recentActivity = activity || [];
                res.locals.allTopics = allTopics || [];

                if (req.session && req.session.userId) {
                    User.findById(req.session.userId, (err, user) => {
                        res.locals.currentUser = user || null;
                        Topic.getFollowedByUser(req.session.userId, (fErr, followed) => {
                            Topic.getFavoritesByUser(req.session.userId, (favErr, favorites) => {
                                Favorite.getByUser(req.session.userId, (pageFavErr, favoritePages) => {
                                    Page.getDraftsByAuthor(req.session.userId, (draftErr, drafts) => {
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
});

// Routes
const wikiRoutes = require('./src/routes/wiki');
const authRoutes = require('./src/routes/auth');

app.use('/', authRoutes);
app.use('/', wikiRoutes);

// Error Handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    const status = err.status || 500;
    res.status(status).render('error', {
        message: process.env.NODE_ENV === 'production' ? 'Error interno.' : err.message,
        status: status,
        wiki: { slug: 'general' }
    });
});

// Start Server
dbReady.then(() => {
    app.listen(PORT, () => {
        console.log(`[SERVER] [VER 1.40] RESTORED (Single Wiki) on port ${PORT}`);
    });
});
