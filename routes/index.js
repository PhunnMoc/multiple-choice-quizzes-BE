const express = require('express');
const quizRoutes = require('./quizRoutes');

const router = express.Router();

/**
 * API Routes
 * All routes are prefixed with /api
 */

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Quiz routes
router.use('/quizzes', quizRoutes);

// Future routes can be added here
// router.use('/users', userRoutes);
// router.use('/rooms', roomRoutes);
// router.use('/games', gameRoutes);

module.exports = router;
