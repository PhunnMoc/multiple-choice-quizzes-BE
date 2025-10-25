const express = require('express');
const QuizHistory = require('../models/QuizHistory');
const router = express.Router();

/**
 * Get quiz history for a user
 * GET /api/quiz-history/:playerId
 */
router.get('/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    // Find all quiz histories where the user participated
    const histories = await QuizHistory.find({
      'participants.playerId': playerId
    })
    .sort({ completionTime: -1 }) // Most recent first
    .limit(50); // Limit to last 50 quizzes
    
    res.json({
      success: true,
      data: histories
    });
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz history'
    });
  }
});

/**
 * Get specific quiz history by room code
 * GET /api/quiz-history/room/:roomCode
 */
router.get('/room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const history = await QuizHistory.findOne({ roomCode });
    
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Quiz history not found'
      });
    }
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching quiz history by room code:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz history'
    });
  }
});

module.exports = router;
