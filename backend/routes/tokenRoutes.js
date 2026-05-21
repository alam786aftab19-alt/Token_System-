const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');
const authMiddleware = require('../middleware/authMiddleware');
const verifyMiddleware = require('../middleware/verifyMiddleware');

// All token routes require active authentication session (valid JWT)
router.use(authMiddleware);

// Get overall queue status (also returns current user's active token if any)
router.get('/queue', tokenController.getQueue);

// Get current active token and current user's token
router.get('/current', tokenController.getCurrentToken);

// Generate new token (requires verified email)
router.post('/generate', verifyMiddleware, tokenController.generateToken);

// Advance the queue to the next pending token (Admin only, checks is_admin in controller)
router.post('/next', verifyMiddleware, tokenController.moveToNext);

module.exports = router;
