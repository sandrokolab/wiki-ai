const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Wiki = require('../models/wiki');
const Page = require('../models/page');
const adminCheck = require('../middleware/admin');

// Apply admin check to all routes in this file
router.use(adminCheck);

// Admin Dashboard
router.get('/', async (req, res) => {
    try {
        // Basic statistics for the dashboard
        const userCount = await User.getCount();
        const wikiCount = await Wiki.getCount();
        const pageCount = await Page.getCount();

        res.render('admin/dashboard', {
            title: 'Panel de Administración',
            stats: { users: userCount, wikis: wikiCount, pages: pageCount },
            user: req.user
        });
    } catch (err) {
        console.error('Admin Dashboard Error:', err);
        res.status(500).send('Error al cargar el panel de administración');
    }
});

// User Management
router.get('/users', async (req, res) => {
    try {
        const users = await User.getAll();
        res.render('admin/users', {
            title: 'Gestión de Usuarios',
            users
        });
    } catch (err) {
        res.status(500).send('Error al cargar usuarios');
    }
});

// Wiki Management
router.get('/wikis', async (req, res) => {
    try {
        const wikis = await Wiki.getAll();
        res.render('admin/wikis', {
            title: 'Gestión de Wikis',
            wikis
        });
    } catch (err) {
        res.status(500).send('Error al cargar wikis');
    }
});

// Global Page Management
router.get('/pages', async (req, res) => {
    try {
        const pages = await Page.getAllGlobal(); // Method to implement or use existing with null wikiId
        res.render('admin/pages', {
            title: 'Gestión Global de Páginas',
            pages
        });
    } catch (err) {
        res.status(500).send('Error al cargar páginas');
    }
});

module.exports = router;
