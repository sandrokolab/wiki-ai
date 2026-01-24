function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }

    // If it's an AJAX/API request, return 401 instead of redirecting
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ error: 'Unauthorized. Please login again.' });
    }

    res.redirect('/login');
}

module.exports = isAuthenticated;
