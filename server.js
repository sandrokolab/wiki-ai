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

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:"],
            "script-src": ["'self'", "'unsafe-inline'"], // Allowed for simple scripts in views
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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'wiki-ai-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Global middleware to provide user and layout data to all templates
app.use((req, res, next) => {
    // Fetch categories and activity for sidebars
    Page.getCategories((catErr, categories) => {
        Revision.getRecentActivity(10, (actErr, activity) => {
            Topic.getAll((topErr, allTopics) => {
                res.locals.allCategories = categories || [];
                res.locals.recentActivity = activity || [];
                res.locals.allTopics = allTopics || [];

                if (req.session && req.session.userId) {
                    User.findById(req.session.userId, (err, user) => {
                        res.locals.currentUser = user || null;

                        // Fetch followed and favorites if user is logged in
                        Topic.getFollowedByUser(req.session.userId, (fErr, followed) => {
                            Topic.getFavoritesByUser(req.session.userId, (favErr, favorites) => {
                                res.locals.userTopics = followed || [];
                                res.locals.favoriteTopics = favorites || [];
                                next();
                            });
                        });
                    });
                } else {
                    res.locals.currentUser = null;
                    res.locals.userTopics = [];
                    res.locals.favoriteTopics = [];
                    next();
                }
            });
        });
    });
});

// Recently Viewed Tracking Middleware
app.use('/wiki/:slug', (req, res, next) => {
    const slug = req.params.slug;
    if (!req.session.viewedPages) req.session.viewedPages = [];

    // We don't have the page info here yet, so we'll 
    // hook into the wiki route or just store the slug for now.
    // Actually, it's better to do this in the wiki.js route handler
    // to have access to the page title/category/author.
    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Routes
const wikiRoutes = require('./src/routes/wiki');
const authRoutes = require('./src/routes/auth');

app.use('/', authRoutes);
app.use('/', wikiRoutes);

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
