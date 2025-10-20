const Quiz = require('../models/Quiz');

/**
 * Quiz Service
 * Contains business logic for quiz operations
 */
class QuizService {
  /**
   * Create a new quiz
   * @param {Object} quizData - Quiz data including title, authorName, and questions
   * @returns {Promise<Object>} Created quiz
   */
  async createQuiz(quizData) {
    try {
      const quiz = new Quiz(quizData);
      const savedQuiz = await quiz.save();
      return savedQuiz;
    } catch (error) {
      throw new Error(`Failed to create quiz: ${error.message}`);
    }
  }

  /**
   * Get a quiz by ID
   * @param {string} quizId - Quiz ID
   * @returns {Promise<Object>} Quiz object
   */
  async getQuizById(quizId) {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('Quiz not found');
      }
      return quiz;
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('Invalid quiz ID format');
      }
      throw new Error(`Failed to get quiz: ${error.message}`);
    }
  }

  /**
   * Get all quizzes created by a specific user with optional pagination
   * @param {string} creatorId - ID of the quiz creator
   * @param {Object} options - Query options (page, limit, sortBy)
   * @returns {Promise<Object>} Object containing quizzes and pagination info
   */
  async getAllQuizzes(creatorId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const query = { creator: creatorId };

      const [quizzes, total] = await Promise.all([
        Quiz.find(query)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('-__v'), // Exclude version field
        Quiz.countDocuments(query)
      ]);

      return {
        quizzes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQuizzes: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to get quizzes: ${error.message}`);
    }
  }

  /**
   * Search quizzes by title or author name for a specific creator
   * @param {string} searchTerm - Search term
   * @param {string} creatorId - ID of the quiz creator
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchQuizzes(searchTerm, creatorId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const searchQuery = {
        creator: creatorId,
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { authorName: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      const [quizzes, total] = await Promise.all([
        Quiz.find(searchQuery)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('-__v'),
        Quiz.countDocuments(searchQuery)
      ]);

      return {
        quizzes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQuizzes: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        },
        searchTerm
      };
    } catch (error) {
      throw new Error(`Failed to search quizzes: ${error.message}`);
    }
  }

  /**
   * Validate quiz data before creation
   * @param {Object} quizData - Quiz data to validate
   * @returns {Object} Validation result
   */
  validateQuizData(quizData) {
    const errors = [];

    // Validate title
    if (!quizData.title || quizData.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (quizData.title.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }

    // Validate author name
    if (quizData.authorName && quizData.authorName.length > 100) {
      errors.push('Author name cannot exceed 100 characters');
    }

    // Validate questions
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      errors.push('Questions array is required');
    } else if (quizData.questions.length === 0) {
      errors.push('Quiz must have at least one question');
    } else {
      // Validate each question
      quizData.questions.forEach((question, index) => {
        if (!question.questionText || question.questionText.trim().length === 0) {
          errors.push(`Question ${index + 1}: Question text is required`);
        } else if (question.questionText.length > 500) {
          errors.push(`Question ${index + 1}: Question text cannot exceed 500 characters`);
        }

        if (!question.options || !Array.isArray(question.options)) {
          errors.push(`Question ${index + 1}: Options array is required`);
        } else if (question.options.length !== 4) {
          errors.push(`Question ${index + 1}: Must have exactly 4 options`);
        } else {
          question.options.forEach((option, optionIndex) => {
            if (!option || option.trim().length === 0) {
              errors.push(`Question ${index + 1}, Option ${optionIndex + 1}: Option text is required`);
            }
          });
        }

        if (typeof question.correctAnswerIndex !== 'number') {
          errors.push(`Question ${index + 1}: Correct answer index must be a number`);
        } else if (question.correctAnswerIndex < 0 || question.correctAnswerIndex > 3) {
          errors.push(`Question ${index + 1}: Correct answer index must be between 0 and 3`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new QuizService();
