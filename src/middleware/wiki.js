const Wiki = require('../models/wiki');

module.exports = (req, res, next) => {
    const wikiSlug = req.params.wiki_slug;

    if (!wikiSlug) {
        // Fallback for routes that might not have the param but are under /w/
        return next();
    }

    Wiki.getBySlug(wikiSlug, (err, wiki) => {
        if (err || !wiki) {
            return res.status(404).render('error', {
                message: 'Wiki no encontrada',
                status: 404
            });
        }

        req.wiki = wiki;
        res.locals.wiki = wiki; // Make it available to EJS
        next();
    });
};
