const swaggerJSDoc = require('swagger-jsdoc');

/**
 * Swagger Configuration
 * API Documentation for Quiz Platform Backend
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Quiz Platform API',
      version: '1.0.0',
      description: 'Backend API for real-time, multiplayer quiz platform',
      contact: {
        name: 'Quiz Platform Team',
        email: 'support@quizplatform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-production-url.com' 
          : 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
              minLength: 2,
              maxLength: 100
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp'
            }
          }
        },
        Question: {
          type: 'object',
          required: ['questionText', 'options', 'correctAnswerIndex'],
          properties: {
            _id: {
              type: 'string',
              description: 'Question ID',
              example: '507f1f77bcf86cd799439012'
            },
            questionText: {
              type: 'string',
              description: 'The question text',
              example: 'What is the capital of France?',
              maxLength: 500
            },
            options: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of 4 answer options',
              example: ['Paris', 'London', 'Berlin', 'Madrid'],
              minItems: 4,
              maxItems: 4
            },
            correctAnswerIndex: {
              type: 'integer',
              description: 'Index of the correct answer (0-3)',
              example: 0,
              minimum: 0,
              maximum: 3
            }
          }
        },
        Quiz: {
          type: 'object',
          required: ['title', 'questions'],
          properties: {
            _id: {
              type: 'string',
              description: 'Quiz ID',
              example: '507f1f77bcf86cd799439013'
            },
            title: {
              type: 'string',
              description: 'Quiz title',
              example: 'Geography Quiz',
              maxLength: 200
            },
            creator: {
              type: 'string',
              description: 'Creator user ID',
              example: '507f1f77bcf86cd799439011'
            },
            authorName: {
              type: 'string',
              description: 'Author display name',
              example: 'John Doe',
              maxLength: 100
            },
            questions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Question'
              },
              description: 'Array of quiz questions',
              minItems: 1
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Quiz creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Quiz last update timestamp'
            }
          }
        },
        Answer: {
          type: 'object',
          required: ['userId', 'quizId', 'roomCode', 'responses', 'totalQuestions'],
          properties: {
            _id: {
              type: 'string',
              description: 'Answer ID',
              example: '507f1f77bcf86cd799439014'
            },
            userId: {
              type: 'string',
              description: 'User ID who submitted the answer',
              example: '507f1f77bcf86cd799439011'
            },
            quizId: {
              type: 'string',
              description: 'Quiz ID',
              example: '507f1f77bcf86cd799439013'
            },
            roomCode: {
              type: 'string',
              description: 'Room code for the quiz session',
              example: 'ABC123'
            },
            responses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  questionIndex: {
                    type: 'integer',
                    description: 'Index of the question',
                    minimum: 0
                  },
                  answer: {
                    type: 'integer',
                    description: 'Selected answer index (0-3)',
                    minimum: 0,
                    maximum: 3
                  },
                  isCorrect: {
                    type: 'boolean',
                    description: 'Whether the answer is correct'
                  },
                  timeSpent: {
                    type: 'integer',
                    description: 'Time spent on this question in milliseconds',
                    minimum: 0
                  }
                }
              }
            },
            totalScore: {
              type: 'integer',
              description: 'Total correct answers',
              minimum: 0
            },
            totalQuestions: {
              type: 'integer',
              description: 'Total number of questions',
              minimum: 1
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Quiz completion timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Something went wrong'
            },
            error: {
              type: 'string',
              description: 'Detailed error information',
              example: 'Validation failed'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './server.js'
  ]
};

const specs = swaggerJSDoc(options);

module.exports = specs;
