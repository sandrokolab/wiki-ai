const Wiki = require('../models/wiki');

module.exports = (req, res, next) => {
    const wikiSlug = req.params.wiki_slug;

    if (!wikiSlug) {
        // Fallback for routes that might not have the param but are under /w/
        return next();
    }

    Wiki.getBySlug(wikiSlug, (err, wiki) => {
        if (err || !wiki) {
            console.error('[WIKI MW] Wiki not found or DB error:', err?.message || 'Not found');
            try {
                return res.status(404).render('error', {
                    message: 'Wiki no encontrada',
                    status: 404
                });
            } catch (renderErr) {
                console.error('[WIKI MW] Failed to render 404 error page:', renderErr.message);
                return res.status(404).send('Error 404: Wiki no encontrada.');
            }
        }

        req.wiki = wiki;
        res.locals.wiki = wiki; // Make it available to EJS
        next();
    });
};
