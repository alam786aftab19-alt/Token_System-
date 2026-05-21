const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public endpoints
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/verify-email', authController.verifyEmail);

// Protected endpoint
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
