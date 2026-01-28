require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pool = require('./database');
const User = require('./src/models/user');
const Page = require('./src/models/page');
const Revision = require('./src/models/revision');
const Topic = require('./src/models/topic');
const Activity = require('./src/models/activity');
const Favorite = require('./src/models/favorite');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate-limiting on Railway
app.set('trust proxy', 1);

// Configure View Engine - DEFINITIVE SETUP
app.set('view engine', 'ejs');
const viewsPath = path.resolve(__dirname, 'src', 'views');
app.set('views', [viewsPath, path.join(__dirname, 'views')]);
console.log(`View engine configured. Views path: ${viewsPath}`);

// Explicitly register EJS engine to avoid "no default engine" issues
app.engine('ejs', require('ejs').renderFile);

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:", "https://unpkg.com"],
            "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            "script-src-attr": ["'self'", "'unsafe-inline'"], // Allow inline event handlers if absolutely necessary, but we moved to listeners
        },
    },
}));
app.use(compression());

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after a minute'
});
app.use(limiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'wiki-ai-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const wikiMiddleware = require('./src/middleware/wiki');

// Global middleware for sidebar data (Wiki-Aware)
const provideWikiData = (req, res, next) => {
    const wikiId = req.wiki ? req.wiki.id : null;

    // If we're not in a wiki context, we might still want global stats or nothing
    if (!wikiId) return next();

    Page.getCategories(wikiId, (catErr, categories) => {
        Activity.getRecent(10, wikiId, (actErr, activity) => {
            Topic.getAll(wikiId, (topErr, allTopics) => {
                res.locals.allCategories = categories || [];
                res.locals.recentActivity = activity || [];
                res.locals.allTopics = allTopics || [];

                // Helper for scoped URLs
                res.locals.wikiUrl = (path) => {
                    const cleanPath = path.startsWith('/') ? path : '/' + path;
                    return `/w/${req.wiki.slug}${cleanPath}`;
                };

                // User-specific data
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
                    res.locals.userTopics = [];
                    res.locals.favoriteTopics = [];
                    res.locals.favoritePages = [];
                    res.locals.userDrafts = [];
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

// Auth routes are global
app.use('/', authRoutes);

// Admin routes (middleware and check inside routes/admin.js)
app.use('/admin', provideWikiData, adminRoutes);

// Redirect root to general wiki
app.get('/', (req, res) => res.redirect('/w/general'));

// All wiki-specific routes under /w/:wiki_slug
app.use('/w/:wiki_slug', wikiMiddleware, provideWikiData, wikiRoutes);


// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).render('error', {
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong on our end.'
            : err.message,
        status: status
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
