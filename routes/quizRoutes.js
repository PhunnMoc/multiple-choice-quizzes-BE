const express = require('express');
const { body } = require('express-validator');
const quizController = require('../controllers/quizController');
const validateRequest = require('../middleware/validateRequest');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Quiz Routes
 * All routes are prefixed with /api/quizzes
 */

// Validation rules for creating a quiz
const createQuizValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  
  body('authorName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Author name cannot exceed 100 characters'),
  
  body('questions')
    .isArray({ min: 1 })
    .withMessage('Quiz must have at least one question'),
  
  body('questions.*.questionText')
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ max: 500 })
    .withMessage('Question text cannot exceed 500 characters'),
  
  body('questions.*.options')
    .isArray({ min: 4, max: 4 })
    .withMessage('Each question must have exactly 4 options'),
  
  body('questions.*.options.*')
    .trim()
    .notEmpty()
    .withMessage('Option text is required'),
  
  body('questions.*.correctAnswerIndex')
    .isInt({ min: 0, max: 3 })
    .withMessage('Correct answer index must be between 0 and 3')
];

// Validation rules for query parameters
const getQuizzesValidation = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('sortBy')
    .optional()
    .isIn(['title', 'authorName', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  
  body('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

/**
 * @route   POST /api/quizzes
 * @desc    Create a new quiz
 * @access  Private (authentication required)
 */
router.post('/', authenticateToken, createQuizValidation, validateRequest, quizController.createQuiz);

/**
 * @route   GET /api/quizzes
 * @desc    Get all quizzes created by the authenticated user with optional pagination and search
 * @access  Private (authentication required)
 * @query   page, limit, sortBy, sortOrder, search
 */
router.get('/', authenticateToken, getQuizzesValidation, validateRequest, quizController.getAllQuizzes);

/**
 * @route   GET /api/quizzes/:id/answers
 * @desc    Get a specific quiz by ID with correct answers
 * @access  Public (in a real app, this might require authentication)
 */
router.get('/:id/answers', quizController.getQuizWithAnswers);

/**
 * @route   PUT /api/quizzes/:id
 * @desc    Update an existing quiz (except id and creator)
 * @access  Private (authentication required)
 */
console.log('Registering PUT /:id route');
router.put('/:id', authenticateToken, createQuizValidation, validateRequest, quizController.updateQuiz);
console.log('PUT /:id route registered successfully');

/**
 * @route   GET /api/quizzes/:id
 * @desc    Get a specific quiz by ID (without answers)
 * @access  Public
 */
router.get('/:id', quizController.getQuizById);

module.exports = router;
