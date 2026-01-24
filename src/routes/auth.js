const express = require('express');
const router = express.Router();
const User = require('../models/user');
const xss = require('xss');

// Register GET
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Register POST
router.post('/register', (req, res) => {
    let { username, email, password } = req.body;

    // XSS Sanitization
    username = xss(username);
    email = xss(email);

    User.create(username, email, password, (err, userId) => {
        if (err) {
            console.error('Registration error:', err);
            const msg = err.code === '23505' ? 'Username or email already exists.' : 'Database error during registration.';
            return res.render('register', { error: msg });
        }
        req.session.userId = userId;
        res.redirect('/');
    });
});

// Login GET
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Login POST
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    User.findByUsername(username, async (err, user) => {
        if (err || !user) {
            return res.render('login', { error: 'Invalid username or password.' });
        }

        const valid = await User.verifyPassword(password, user.password);
        if (!valid) {
            return res.render('login', { error: 'Invalid username or password.' });
        }

        req.session.userId = user.id;
        res.redirect('/');
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;
