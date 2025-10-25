const jwt = require('jsonwebtoken');
const User = require('../models/User');
const roomService = require('./roomService');
const doQuizService = require('./doQuizzService');

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
          const room = roomService.getRoom(roomCode);
          
          // Join socket room for broadcasting
          socket.join(roomCode);
          
          // Store room code in socket for cleanup
          socket.roomCode = roomCode;

          // Ensure host is the first participant
          try {
            roomService.joinRoom(roomCode, socket.id, socket.user.name || 'Host');
          } catch (e) {
            // If already joined or any benign error, ignore
          }
          
          // Get participants list (now includes host)
          const participantsList = Array.from(room.participants.values()).map(p => ({
            playerId: p.playerId,
            name: p.name,
            score: p.score,
            isConnected: true,
            isReady: p.isReady || false
          }));
          
          socket.emit('room-created', {
            roomCode,
            message: 'Room created successfully',
            participantCount: room.participants.size,
            participants: participantsList
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
          
          // Get all participants info
          const participantsList = Array.from(room.participants.values()).map(p => ({
            playerId: p.playerId,
            name: p.name,
            score: p.score,
            isConnected: true,
            isReady: p.isReady || false
          }));
          
          socket.emit('room-joined', {
            roomCode,
            message: 'Successfully joined room',
            quizTitle: room.quizData.title,
            participantCount: room.participants.size,
            participants: participantsList,
            playerId: participant.playerId,
            gameSessionId: room.gameSessionId
          });

          // Notify all participants (including host)
          this.io.to(roomCode).emit('participant-joined', {
            name,
            playerId: participant.playerId,
            participantCount: room.participants.size,
            participants: participantsList
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

          // Get room data
          const room = roomService.getRoom(roomCode);
          if (!room) {
            return socket.emit('error', { message: 'Room not found' });
          }

          // Check if user is host
          const isHost = roomService.isHost(roomCode, socket.id);
          if (!isHost) {
            return socket.emit('error', { message: 'Only the host can start the quiz' });
          }

          // Start quiz using doQuizService
          const quizSession = doQuizService.startQuiz(roomCode, room.quizData, room.participants, this.io);
          const currentQuestion = doQuizService.getCurrentQuestion(roomCode);
          const leaderboard = doQuizService.getLeaderboard(roomCode);

          console.log(`🎮 Quiz session created:`, {
            roomCode,
            quizSession: quizSession ? 'created' : 'null',
            currentQuestion: currentQuestion ? 'exists' : 'null',
            leaderboard: leaderboard ? leaderboard.length : 0
          });

          // Broadcast to all participants in the room
          this.io.to(roomCode).emit('quiz-started', {
            question: currentQuestion,
            participantCount: room.participants.size,
            gameSessionId: room.gameSessionId,
            leaderboard: leaderboard
          });

          console.log(`🎮 Quiz started in room ${roomCode} by ${socket.user.name} - event emitted to ${room.participants.size} participants`);
        } catch (error) {
          console.error('Error starting quiz:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Submit answer event
      console.log('🔌 Registering submit-answer event listener for socket:', socket.id);
      socket.on('submit-answer', async (data) => {
        try {
          console.log('📥 Submit-answer event received:', {
            roomCode: data.roomCode,
            answer: data.answer,
            socketId: socket.id,
            userName: socket.user?.name
          });
          
          const { roomCode, answer } = data;
          
          if (!roomCode || answer === undefined) {
            console.log('📥 Submit-answer validation failed: missing roomCode or answer');
            return socket.emit('error', { message: 'Room code and answer are required' });
          }

          // Check if quiz is active
          if (!doQuizService.isQuizActive(roomCode)) {
            console.log('📥 Submit-answer failed: quiz not active');
            return socket.emit('error', { message: 'Quiz is not active' });
          }

          console.log('📥 Processing submit-answer for room:', roomCode);
          
          // Submit answer using doQuizService
          const result = doQuizService.submitAnswer(roomCode, socket.id, answer);
          const leaderboard = doQuizService.getLeaderboard(roomCode);

          // Send result to participant
          socket.emit('answer-submitted', {
            isCorrect: result.isCorrect,
            timeSpent: result.timeSpent,
            currentScore: result.currentScore,
            participantId: result.participantId,
            participantName: result.participantName
          });

          // Broadcast updated leaderboard to all participants
          this.io.to(roomCode).emit('leaderboard-updated', {
            leaderboard: leaderboard,
            participantCount: leaderboard.length
          });

          console.log(`✅ Answer submitted in room ${roomCode} by ${result.participantName}: ${answer} (${result.isCorrect ? 'correct' : 'incorrect'})`);
        } catch (error) {
          console.error('Error submitting answer:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Next question event (automatic after timer)
      socket.on('next-quiz', async (data) => {
        try {
          const { roomCode } = data;
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          // Check if quiz is active
          if (!doQuizService.isQuizActive(roomCode)) {
            return socket.emit('error', { message: 'Quiz is not active' });
          }

          // Move to next question
          const nextQuestion = doQuizService.nextQuestion(roomCode);
          
          if (!nextQuestion) {
            // Quiz completed
            const finalResults = doQuizService.endQuiz(roomCode);
            
            this.io.to(roomCode).emit('quiz-completed', {
              results: finalResults,
              message: 'Quiz completed successfully'
            });

            console.log(`🏁 Quiz completed for room ${roomCode}`);
          } else {
            // Next question
            const leaderboard = doQuizService.getLeaderboard(roomCode);
            
            this.io.to(roomCode).emit('next-question', {
              question: nextQuestion,
              participantCount: leaderboard.length,
              leaderboard: leaderboard
            });

            console.log(`📝 Question ${nextQuestion.questionIndex + 1} started for room ${roomCode}`);
          }
        } catch (error) {
          console.error('Error advancing question:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Get leaderboard event
      socket.on('get-leaderboard', async (data) => {
        try {
          const { roomCode } = data;
          
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          const leaderboard = doQuizService.getLeaderboard(roomCode);
          if (!leaderboard) {
            return socket.emit('error', { message: 'Room not found' });
          }

          socket.emit('leaderboard-data', {
            leaderboard: leaderboard,
            participantCount: leaderboard.length
          });
        } catch (error) {
          console.error('Error getting leaderboard:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Check room status event
      socket.on('check-room-status', (data) => {
        try {
          const { roomCode } = data;
          if (!roomCode) {
            return socket.emit('error', { message: 'Room code is required' });
          }

          const room = roomService.getRoom(roomCode);
          if (!room) {
            // Room doesn't exist - notify client
            socket.emit('room-cancelled', {
              message: 'The quiz room has been cancelled.',
              roomCode: roomCode
            });
            return;
          }

          // Room exists - send current status
          const participantsList = Array.from(room.participants.values()).map(p => ({
            playerId: p.playerId,
            name: p.name,
            score: p.score,
            isConnected: true,
            isReady: p.isReady || false
          }));

          socket.emit('room-status', {
            roomCode,
            participantCount: room.participants.size,
            participants: participantsList,
            isActive: room.isActive
          });
        } catch (error) {
          console.error('Error checking room status:', error);
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
              // Check if the disconnecting user is the host
              const isHost = roomService.isHost(socket.roomCode, socket.id);
              
              if (isHost) {
                // Host left - cancel the room and notify all participants
                console.log(`Host ${participant.name} left room ${socket.roomCode} - cancelling room`);
                
                // Store room code before cancelling
                const roomCodeToCancel = socket.roomCode;
                
                // Notify all participants that room is cancelled BEFORE cancelling the room
                this.io.to(roomCodeToCancel).emit('room-cancelled', {
                  message: 'Host has left the room. The quiz has been cancelled.',
                  roomCode: roomCodeToCancel
                });
                
                // Cancel the room AFTER sending the event
                roomService.cancelRoom(roomCodeToCancel);
              } else {
                // Regular participant left - just notify others
                const updatedParticipantsList = Array.from(room.participants.values())
                  .filter(p => p.playerId !== participant.playerId)
                  .map(p => ({
                    playerId: p.playerId,
                    name: p.name,
                    score: p.score,
                    isConnected: true,
                    isReady: p.isReady || false
                  }));
                
                // Notify all participants (including host)
                this.io.to(socket.roomCode).emit('participant-left', {
                  name: participant.name,
                  participantCount: room.participants.size - 1,
                  participants: updatedParticipantsList
                });
                
                roomService.leaveRoom(socket.roomCode, socket.id);
              }
            }
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
