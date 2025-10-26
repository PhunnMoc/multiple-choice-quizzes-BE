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
 * @swagger
 * /api/quizzes:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - questions
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Geography Quiz"
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "John Doe"
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionText
 *                     - options
 *                     - correctAnswerIndex
 *                   properties:
 *                     questionText:
 *                       type: string
 *                       maxLength: 500
 *                       example: "What is the capital of France?"
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                       minItems: 4
 *                       maxItems: 4
 *                       example: ["Paris", "London", "Berlin", "Madrid"]
 *                     correctAnswerIndex:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 3
 *                       example: 0
 *     responses:
 *       201:
 *         description: Quiz created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quiz:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             title:
 *                               type: string
 *                             authorName:
 *                               type: string
 *                             questionsCount:
 *                               type: integer
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticateToken, createQuizValidation, validateRequest, quizController.createQuiz);

/**
 * @swagger
 * /api/quizzes:
 *   get:
 *     summary: Get all quizzes (authenticated user's quizzes)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, authorName, createdAt, updatedAt]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: Quizzes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quizzes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               authorName:
 *                                 type: string
 *                               questionsCount:
 *                                 type: integer
 *                               createdAt:
 *                                 type: string
 *                               updatedAt:
 *                                 type: string
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             total:
 *                               type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getQuizzesValidation, validateRequest, quizController.getAllQuizzes);

/**
 * @swagger
 * /api/quizzes/{id}/answers:
 *   get:
 *     summary: Get a quiz by ID with correct answers
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: Quiz with answers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quiz:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             title:
 *                               type: string
 *                             authorName:
 *                               type: string
 *                             questions:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   questionText:
 *                                     type: string
 *                                   options:
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   correctAnswerIndex:
 *                                     type: integer
 *                                     minimum: 0
 *                                     maximum: 3
 *                             createdAt:
 *                               type: string
 *                             updatedAt:
 *                               type: string
 *       400:
 *         description: Invalid quiz ID
 *       404:
 *         description: Quiz not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/answers', quizController.getQuizWithAnswers);

/**
 * @swagger
 * /api/quizzes/{id}:
 *   put:
 *     summary: Update an existing quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - questions
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Updated Geography Quiz"
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "John Doe"
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionText
 *                     - options
 *                     - correctAnswerIndex
 *                   properties:
 *                     questionText:
 *                       type: string
 *                       maxLength: 500
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                       minItems: 4
 *                       maxItems: 4
 *                     correctAnswerIndex:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 3
 *     responses:
 *       200:
 *         description: Quiz updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quiz:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             title:
 *                               type: string
 *                             authorName:
 *                               type: string
 *                             questionsCount:
 *                               type: integer
 *                             createdAt:
 *                               type: string
 *                             updatedAt:
 *                               type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this quiz
 *       404:
 *         description: Quiz not found
 *       500:
 *         description: Internal server error
 */
console.log('Registering PUT /:id route');
router.put('/:id', authenticateToken, createQuizValidation, validateRequest, quizController.updateQuiz);
console.log('PUT /:id route registered successfully');

/**
 * @swagger
 * /api/quizzes/{id}:
 *   get:
 *     summary: Get a specific quiz by ID (without correct answers)
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Quiz retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quiz:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: "507f1f77bcf86cd799439013"
 *                             title:
 *                               type: string
 *                               example: "Geography Quiz"
 *                             authorName:
 *                               type: string
 *                               example: "John Doe"
 *                             questions:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   questionText:
 *                                     type: string
 *                                     example: "What is the capital of France?"
 *                                   options:
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                     example: ["Paris", "London", "Berlin", "Madrid"]
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                             updatedAt:
 *                               type: string
 *                               format: date-time
 *       400:
 *         description: Invalid quiz ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', quizController.getQuizById);

module.exports = router;
