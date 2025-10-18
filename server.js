require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const database = require('./config/database');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

/**
 * Express Application Setup
 * Main server file for the Quiz Platform Backend
 */
class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging for development
    if (process.env.NODE_ENV === 'development') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Welcome to Quiz Platform API',
        version: '1.0.0',
        documentation: '/api/health',
        endpoints: {
          quizzes: '/api/quizzes',
          health: '/api/health'
        }
      });
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // Future WebSocket endpoint placeholder
    this.app.get('/ws', (req, res) => {
      res.json({
        success: true,
        message: 'WebSocket endpoint - Coming soon!',
        note: 'This will be used for real-time multiplayer quiz sessions'
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Connect to database
      await database.connect(process.env.MONGODB_URI);

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log('\n🚀 Quiz Platform Backend Server Started!');
        console.log('=====================================');
        console.log(`🌐 Server running on port ${this.port}`);
        console.log(`🔗 Local: http://localhost:${this.port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🗄️  Database: ${database.getStatus().isConnected ? 'Connected' : 'Disconnected'}`);
        console.log('=====================================\n');
        
        // Log available endpoints
        console.log('📋 Available Endpoints:');
        console.log('  GET  /                    - API information');
        console.log('  GET  /api/health          - Health check');
        console.log('  POST /api/quizzes         - Create quiz');
        console.log('  GET  /api/quizzes         - List all quizzes');
        console.log('  GET  /api/quizzes/:id     - Get quiz by ID');
        console.log('  GET  /api/quizzes/:id/answers - Get quiz with answers');
        console.log('  GET  /ws                  - WebSocket info (future)\n');
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${this.port} is already in use`);
        } else {
          console.error('❌ Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    try {
      if (this.server) {
        this.server.close();
        console.log('🛑 Server stopped');
      }
      await database.disconnect();
    } catch (error) {
      console.error('❌ Error stopping server:', error.message);
    }
  }
}

// Create and start server
const server = new Server();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start the server
server.start();

module.exports = server;
