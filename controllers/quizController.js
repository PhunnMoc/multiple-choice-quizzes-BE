const quizService = require('../services/quizService');

/**
 * Quiz Controller
 * Handles HTTP requests for quiz operations
 */
class QuizController {
  /**
   * Create a new quiz
   * POST /api/quizzes
   */
  async createQuiz(req, res) {
    try {
      // Validate input data
      const validation = quizService.validateQuizData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Create the quiz with creator info
      const quizData = {
        ...req.body,
        creator: req.user.userId
      };
      const quiz = await quizService.createQuiz(quizData);

      res.status(201).json({
        success: true,
        message: 'Quiz created successfully',
        data: {
          quiz: {
            id: quiz._id,
            title: quiz.title,
            authorName: quiz.authorName,
            questionsCount: quiz.questions.length,
            createdAt: quiz.createdAt
          }
        }
      });
    } catch (error) {
      console.error('Error creating quiz:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update an existing quiz
   * PUT /api/quizzes/:id
   */
  async updateQuiz(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Quiz ID is required'
        });
      }

      // Validate input data
      const validation = quizService.validateQuizData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Check if quiz exists and belongs to the user
      const existingQuiz = await quizService.getQuizById(id);
      if (existingQuiz.creator.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own quizzes'
        });
      }

      // Update the quiz (excluding id and creator)
      const updateData = {
        title: req.body.title,
        authorName: req.body.authorName,
        questions: req.body.questions,
        updatedAt: new Date()
      };

      const updatedQuiz = await quizService.updateQuiz(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Quiz updated successfully',
        data: {
          quiz: {
            id: updatedQuiz._id,
            title: updatedQuiz.title,
            authorName: updatedQuiz.authorName,
            questionsCount: updatedQuiz.questions.length,
            createdAt: updatedQuiz.createdAt,
            updatedAt: updatedQuiz.updatedAt
          }
        }
      });
    } catch (error) {
      console.error('Error updating quiz:', error);
      
      if (error.message === 'Quiz not found') {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      if (error.message === 'Invalid quiz ID format') {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get a quiz by ID
   * GET /api/quizzes/:id
   */
  async getQuizById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Quiz ID is required'
        });
      }

      const quiz = await quizService.getQuizById(id);

      res.status(200).json({
        success: true,
        message: 'Quiz retrieved successfully',
        data: {
          quiz: {
            id: quiz._id,
            title: quiz.title,
            authorName: quiz.authorName,
            questions: quiz.questions.map(q => ({
              id: q._id,
              questionText: q.questionText,
              options: q.options,
              // Note: We don't expose the correct answer index in the response
              // This would be handled differently in a real game scenario
            })),
            createdAt: quiz.createdAt,
            updatedAt: quiz.updatedAt
          }
        }
      });
    } catch (error) {
      console.error('Error getting quiz:', error);
      
      if (error.message === 'Quiz not found') {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      if (error.message === 'Invalid quiz ID format') {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get all quizzes created by the authenticated user with optional pagination and search
   * GET /api/quizzes
   */
  async getAllQuizzes(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      const userId = req.user.userId; // Get user ID from authenticated token
      let result;

      // If search term is provided, perform search
      if (search && search.trim()) {
        result = await quizService.searchQuizzes(search.trim(), userId, {
          page: parseInt(page),
          limit: parseInt(limit),
          sortBy,
          sortOrder
        });
      } else {
        result = await quizService.getAllQuizzes(userId, {
          page: parseInt(page),
          limit: parseInt(limit),
          sortBy,
          sortOrder
        });
      }

      // Format the response to exclude sensitive data
      const formattedQuizzes = result.quizzes.map(quiz => ({
        id: quiz._id,
        title: quiz.title,
        authorName: quiz.authorName,
        questionsCount: quiz.questions.length,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt
      }));

      res.status(200).json({
        success: true,
        message: search ? 'Search results retrieved successfully' : 'Your quizzes retrieved successfully',
        data: {
          quizzes: formattedQuizzes,
          pagination: result.pagination,
          ...(result.searchTerm && { searchTerm: result.searchTerm })
        }
      });
    } catch (error) {
      console.error('Error getting quizzes:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get quiz with answers (for admin/author purposes)
   * GET /api/quizzes/:id/answers
   */
  async getQuizWithAnswers(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Quiz ID is required'
        });
      }

      const quiz = await quizService.getQuizById(id);

      res.status(200).json({
        success: true,
        message: 'Quiz with answers retrieved successfully',
        data: {
          quiz: {
            id: quiz._id,
            title: quiz.title,
            authorName: quiz.authorName,
            questions: quiz.questions.map(q => ({
              id: q._id,
              questionText: q.questionText,
              options: q.options,
              correctAnswerIndex: q.correctAnswerIndex
            })),
            createdAt: quiz.createdAt,
            updatedAt: quiz.updatedAt
          }
        }
      });
    } catch (error) {
      console.error('Error getting quiz with answers:', error);
      
      if (error.message === 'Quiz not found') {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      if (error.message === 'Invalid quiz ID format') {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update an existing quiz
   * PUT /api/quizzes/:id
   */
  async updateQuiz(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Quiz ID is required'
        });
      }

      // Validate input data
      const validationResult = quizService.validateQuizData(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // Check if quiz exists and user owns it
      const existingQuiz = await quizService.getQuizById(id);
      if (!existingQuiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      if (existingQuiz.creator.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own quizzes'
        });
      }

      // Prepare update data (exclude id and creator)
      const updateData = {
        title: req.body.title,
        authorName: req.body.authorName,
        questions: req.body.questions,
        updatedAt: new Date()
      };

      const updatedQuiz = await quizService.updateQuiz(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Quiz updated successfully',
        data: {
          quiz: {
            id: updatedQuiz._id,
            title: updatedQuiz.title,
            authorName: updatedQuiz.authorName,
            questionsCount: updatedQuiz.questions.length,
            createdAt: updatedQuiz.createdAt,
            updatedAt: updatedQuiz.updatedAt
          }
        }
      });
    } catch (error) {
      console.error('Error updating quiz:', error);
      
      if (error.message === 'Quiz not found') {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      if (error.message === 'Invalid quiz ID format') {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new QuizController();
