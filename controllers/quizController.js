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

      // Create the quiz
      const quiz = await quizService.createQuiz(req.body);

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
   * Get all quizzes with optional pagination and search
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

      let result;

      // If search term is provided, perform search
      if (search && search.trim()) {
        result = await quizService.searchQuizzes(search.trim(), {
          page: parseInt(page),
          limit: parseInt(limit),
          sortBy,
          sortOrder
        });
      } else {
        result = await quizService.getAllQuizzes({
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
        message: search ? 'Search results retrieved successfully' : 'Quizzes retrieved successfully',
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
}

module.exports = new QuizController();
