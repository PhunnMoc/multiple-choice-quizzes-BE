const jwt = require('jsonwebtoken');
const User = require('../models/User');
const roomService = require('./roomService');

/**
 * Socket.io Service
 * Handles real-time communication for quiz rooms
 */
class SocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.io with the HTTP server
   * @param {object} server - HTTP server instance
   */
  initialize(server) {
    const { Server } = require('socket.io');
    
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.ALLOWED_ORIGINS?.split(',') || false
          : true,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log('🔌 Socket.io initialized');
  }

  /**
   * Setup Socket.io middleware for authentication
   */
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          // Allow anonymous connections for joining rooms
          socket.user = null;
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = {
          id: user._id,
          name: user.name,
          email: user.email
        };

        next();
      } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}${socket.user ? ` (${socket.user.name})` : ' (anonymous)'}`);

      // Create room event
      socket.on('create-room', async (data) => {
        try {
          if (!socket.user) {
            return socket.emit('error', { message: 'Authentication required to create rooms' });
          }

          const { quizId } = data;
          if (!quizId) {
            return socket.emit('error', { message: 'Quiz ID is required' });
          }

          const roomCode = await roomService.createRoom(quizId, socket.user.id);
          
          socket.emit('room-created', {
            roomCode,
            message: 'Room created successfully'
          });

          console.log(`Room ${roomCode} created by ${socket.user.name}`);
        } catch (error) {
          console.error('Error creating room:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Join room event
      socket.on('join-room', async (data) => {
        try {
          const { roomCode, name } = data;
          
          if (!roomCode || !name) {
            return socket.emit('error', { message: 'Room code and name are required' });
          }

          const room = roomService.joinRoom(roomCode, socket.id, name);
          
          // Join socket room for broadcasting
          socket.join(roomCode);
          
          // Store room code in socket for cleanup
          socket.roomCode = roomCode;

          const participant = room.participants.get(socket.id);
          socket.emit('room-joined', {
            roomCode,
            message: 'Successfully joined room',
            quizTitle: room.quizData.title,
            participantCount: room.participants.size,
            playerId: participant.playerId,
            gameSessionId: room.gameSessionId
          });

          // Notify other participants
          socket.to(roomCode).emit('participant-joined', {
            name,
            playerId: participant.playerId,
            participantCount: room.participants.size
          });

          console.log(`${name} joined room ${roomCode}`);
        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Start quiz event
      socket.on('start-quiz', async (data) => {
        try {
          if (!socket.user) {
            return socket.emit('error', { message: 'Authentication required to start quiz' });
          }

          const { roomCode } = data;
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          const room = roomService.startQuiz(roomCode, socket.user.id);
          const question = roomService.getCurrentQuestion(roomCode);

          // Get initial leaderboard
          const leaderboard = roomService.getLeaderboard(roomCode);

          // Broadcast to all participants in the room
          this.io.to(roomCode).emit('quiz-started', {
            question,
            participantCount: room.participants.size,
            gameSessionId: room.gameSessionId,
            leaderboard
          });

          console.log(`Quiz started in room ${roomCode} by ${socket.user.name}`);
        } catch (error) {
          console.error('Error starting quiz:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Submit answer event
      socket.on('submit-answer', async (data) => {
        try {
          const { roomCode, answer, clientTimeTaken } = data;
          
          if (!roomCode || answer === undefined) {
            return socket.emit('error', { message: 'Room code and answer are required' });
          }

          const result = roomService.submitAnswer(roomCode, socket.id, answer, clientTimeTaken);
          const room = roomService.getRoom(roomCode);
          const participant = room.participants.get(socket.id);

          socket.emit('answer-submitted', {
            isCorrect: result.isCorrect,
            timeSpent: result.timeSpent,
            serverTimeSpent: result.serverTimeSpent,
            currentScore: result.currentScore,
            playerId: result.playerId
          });

          // Broadcast updated leaderboard to all participants
          const leaderboard = roomService.getLeaderboard(roomCode);
          this.io.to(roomCode).emit('leaderboard-updated', leaderboard);

          // Check if all participants have answered
          const allAnswered = Array.from(room.participants.values())
            .every(p => p.answers.some(a => a.questionIndex === room.currentQuestion));

          if (allAnswered) {
            // Auto-advance to next question
            setTimeout(() => {
              this.advanceToNextQuestion(roomCode, socket.user?.id);
            }, 2000); // Wait 2 seconds to show results
          }

          console.log(`Answer submitted in room ${roomCode}: ${answer}`);
        } catch (error) {
          console.error('Error submitting answer:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Next question event (host only)
      socket.on('next-quiz', async (data) => {
        try {
          if (!socket.user) {
            return socket.emit('error', { message: 'Authentication required' });
          }

          const { roomCode } = data;
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          this.advanceToNextQuestion(roomCode, socket.user.id);
        } catch (error) {
          console.error('Error advancing question:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Get leaderboard event
      socket.on('get-leaderboard', async (data) => {
        try {
          const { roomCode, currentQuestionOnly = false } = data;
          
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          const leaderboard = roomService.getLeaderboard(roomCode, currentQuestionOnly);
          if (!leaderboard) {
            return socket.emit('error', { message: 'Room not found' });
          }

          socket.emit('leaderboard-data', leaderboard);
        } catch (error) {
          console.error('Error getting leaderboard:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Disconnect event
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        if (socket.roomCode) {
          const room = roomService.getRoom(socket.roomCode);
          if (room) {
            const participant = room.participants.get(socket.id);
            if (participant) {
              // Notify other participants
              socket.to(socket.roomCode).emit('participant-left', {
                name: participant.name,
                participantCount: room.participants.size - 1
              });
            }
            
            roomService.leaveRoom(socket.roomCode, socket.id);
          }
        }
      });
    });
  }

  /**
   * Advance to next question
   * @param {string} roomCode - Room code
   * @param {string} hostId - Host user ID
   */
  async advanceToNextQuestion(roomCode, hostId) {
    try {
      const result = roomService.nextQuestion(roomCode, hostId);
      const room = roomService.getRoom(roomCode);

      if (result.isComplete) {
        // Quiz completed
        const results = roomService.getRoomResults(roomCode);
        
        // Save results to database
        await roomService.saveQuizResults(roomCode);
        
        // Broadcast final results
        this.io.to(roomCode).emit('quiz-completed', {
          results,
          message: 'Quiz completed!'
        });

        // Clean up room after 30 seconds
        setTimeout(() => {
          roomService.deleteRoom(roomCode);
        }, 30000);

        console.log(`Quiz completed in room ${roomCode}`);
      } else {
        // Next question
        const question = roomService.getCurrentQuestion(roomCode);
        const leaderboard = roomService.getLeaderboard(roomCode);
        
        this.io.to(roomCode).emit('next-question', {
          question,
          participantCount: room.participants.size,
          leaderboard
        });

        console.log(`Advanced to question ${result.currentQuestion + 1} in room ${roomCode}`);
      }
    } catch (error) {
      console.error('Error advancing question:', error);
      this.io.to(roomCode).emit('error', { message: error.message });
    }
  }

  /**
   * Get Socket.io instance
   * @returns {object} Socket.io instance
   */
  getIO() {
    return this.io;
  }
}

module.exports = new SocketService();
