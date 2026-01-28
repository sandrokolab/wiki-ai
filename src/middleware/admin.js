module.exports = function (req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).render('error', {
        message: 'No tienes permisos para acceder a esta sección.',
        error: { status: 403 }
    });
};
