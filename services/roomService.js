const Quiz = require('../models/Quiz');
const Answer = require('../models/Answer');

/**
 * Room Management Service
 * Handles in-memory room state and operations
 */
class RoomService {
  constructor() {
    // In-memory storage for active rooms
    // Structure: roomCode => { quizId, hostId, participants, currentQuestion, quizData, timer, isActive }
    this.rooms = new Map();
    
    // Track timers for each room
    this.timers = new Map();
  }

  /**
   * Generate a unique room code
   * @returns {string} Unique room code
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.rooms.has(result)) {
      return this.generateRoomCode();
    }
    
    return result;
  }

  /**
   * Generate a unique player ID
   * @returns {string} Unique player ID
   */
  generatePlayerId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create a new room
   * @param {string} quizId - Quiz ID
   * @param {string} hostId - Host user ID
   * @returns {string} Room code
   */
  async createRoom(quizId, hostId) {
    try {
      // Fetch quiz data
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      const roomCode = this.generateRoomCode();
      
      const room = {
        quizId,
        hostId,
        participants: new Map(), // socketId => { playerId, name, answers: [], score: 0, isReady: false }
        currentQuestion: 0,
        quizData: quiz,
        isActive: false,
        isCompleted: false,
        startTime: null,
        questionStartTime: null,
        gameSessionId: this.generatePlayerId(), // Unique game session ID
        maxParticipants: 50,
        questionDuration: 30000 // 30 seconds per question
      };

      this.rooms.set(roomCode, room);
      
      console.log(`Room created: ${roomCode} for quiz: ${quizId}`);
      return roomCode;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  /**
   * Join a room
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID
   * @param {string} name - Participant name
   * @returns {object} Room data
   */
  joinRoom(roomCode, socketId, name) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.isCompleted) {
      throw new Error('Quiz has already ended');
    }

    // Check room capacity
    if (room.participants.size >= room.maxParticipants) {
      throw new Error('Room is full');
    }

    // Check if user already in room
    if (room.participants.has(socketId)) {
      throw new Error('Already joined this room');
    }

    // Generate unique player ID
    const playerId = this.generatePlayerId();

    // Add participant
    room.participants.set(socketId, {
      playerId,
      name,
      answers: [],
      score: 0,
      joinedAt: new Date(),
      isReady: false
    });

    console.log(`User ${name} (Player ID: ${playerId}) joined room ${roomCode}`);
    return room;
  }

  /**
   * Leave a room
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID
   */
  leaveRoom(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const participant = room.participants.get(socketId);
    if (participant) {
      console.log(`User ${participant.name} left room ${roomCode}`);
      room.participants.delete(socketId);
    }

    // If no participants left, delete room
    if (room.participants.size === 0) {
      this.deleteRoom(roomCode);
    }
  }

  /**
   * Start a quiz
   * @param {string} roomCode - Room code
   * @param {string} hostId - Host user ID
   */
  startQuiz(roomCode, hostId) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.hostId !== hostId) {
      throw new Error('Only the host can start the quiz');
    }

    if (room.isActive) {
      throw new Error('Quiz is already active');
    }

    if (room.participants.size === 0) {
      throw new Error('Cannot start quiz with no participants');
    }

    room.isActive = true;
    room.startTime = new Date();
    room.currentQuestion = 0;
    room.questionStartTime = new Date();

    // Start timer for first question
    this.startQuestionTimer(roomCode);

    console.log(`Quiz started in room ${roomCode} with ${room.participants.size} participants`);
    return room;
  }

  /**
   * Submit an answer
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID
   * @param {number} answer - Answer index (0-3)
   * @param {number} clientTimeTaken - Client-side time taken (optional, for validation)
   */
  submitAnswer(roomCode, socketId, answer, clientTimeTaken = null) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isActive) {
      throw new Error('Quiz is not active');
    }

    const participant = room.participants.get(socketId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    // Check if already answered this question
    const existingAnswer = participant.answers.find(a => a.questionIndex === room.currentQuestion);
    if (existingAnswer) {
      throw new Error('Already answered this question');
    }

    const question = room.quizData.questions[room.currentQuestion];
    const isCorrect = answer === question.correctAnswerIndex;
    
    // Server-authoritative timing (use server timestamp)
    const serverTimeSpent = Date.now() - room.questionStartTime.getTime();
    
    // Validate client time if provided (should be within reasonable range)
    let timeSpent = serverTimeSpent;
    if (clientTimeTaken && Math.abs(clientTimeTaken - serverTimeSpent) < 5000) {
      // If client time is within 5 seconds of server time, use it for better UX
      timeSpent = clientTimeTaken;
    }

    // Add answer with server timestamp
    participant.answers.push({
      questionIndex: room.currentQuestion,
      answer,
      isCorrect,
      timeSpent,
      serverTimeSpent,
      submittedAt: new Date()
    });

    // Update score
    if (isCorrect) {
      participant.score++;
    }

    console.log(`Answer submitted in room ${roomCode} by ${participant.name}: ${answer} (${isCorrect ? 'correct' : 'incorrect'}) in ${timeSpent}ms`);
    return { 
      isCorrect, 
      timeSpent, 
      serverTimeSpent,
      currentScore: participant.score,
      playerId: participant.playerId
    };
  }

  /**
   * Move to next question
   * @param {string} roomCode - Room code
   * @param {string} hostId - Host user ID
   */
  nextQuestion(roomCode, hostId) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.hostId !== hostId) {
      throw new Error('Only the host can advance questions');
    }

    if (!room.isActive) {
      throw new Error('Quiz is not active');
    }

    // Clear current timer
    this.clearQuestionTimer(roomCode);

    room.currentQuestion++;
    room.questionStartTime = new Date();

    // Check if quiz is complete
    if (room.currentQuestion >= room.quizData.questions.length) {
      room.isActive = false;
      room.isCompleted = true;
      console.log(`Quiz completed in room ${roomCode}`);
      return { isComplete: true };
    }

    // Start timer for next question
    this.startQuestionTimer(roomCode);

    console.log(`Moved to question ${room.currentQuestion + 1} in room ${roomCode}`);
    return { isComplete: false, currentQuestion: room.currentQuestion };
  }

  /**
   * Start timer for current question
   * @param {string} roomCode - Room code
   */
  startQuestionTimer(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const timer = setTimeout(() => {
      console.log(`Time up for question ${room.currentQuestion + 1} in room ${roomCode}`);
      // Auto-advance to next question
      this.nextQuestion(roomCode, room.hostId);
    }, room.questionDuration);

    this.timers.set(roomCode, timer);
  }

  /**
   * Clear question timer
   * @param {string} roomCode - Room code
   */
  clearQuestionTimer(roomCode) {
    const timer = this.timers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomCode);
    }
  }

  /**
   * Get room data
   * @param {string} roomCode - Room code
   * @returns {object} Room data
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  /**
   * Get current question for room
   * @param {string} roomCode - Room code
   * @returns {object} Question data
   */
  getCurrentQuestion(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || !room.isActive) return null;

    const question = room.quizData.questions[room.currentQuestion];
    return {
      questionIndex: room.currentQuestion,
      questionText: question.questionText,
      options: question.options,
      timeRemaining: this.getTimeRemaining(roomCode),
      startAt: room.questionStartTime.getTime(), // Client-side timer start timestamp
      duration: room.questionDuration,
      totalQuestions: room.quizData.questions.length
    };
  }

  /**
   * Get time remaining for current question
   * @param {string} roomCode - Room code
   * @returns {number} Time remaining in milliseconds
   */
  getTimeRemaining(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || !room.questionStartTime) return 0;

    const elapsed = Date.now() - room.questionStartTime.getTime();
    return Math.max(0, room.questionDuration - elapsed);
  }

  /**
   * Get leaderboard for current question or overall
   * @param {string} roomCode - Room code
   * @param {boolean} currentQuestionOnly - If true, only show scores for current question
   * @returns {object} Leaderboard data
   */
  getLeaderboard(roomCode, currentQuestionOnly = false) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const participants = Array.from(room.participants.values())
      .map(p => {
        let score = p.score;
        if (currentQuestionOnly) {
          // Count correct answers for current question only
          score = p.answers.filter(a => a.questionIndex === room.currentQuestion && a.isCorrect).length;
        }
        
        return {
          playerId: p.playerId,
          name: p.name,
          score,
          totalQuestions: currentQuestionOnly ? 1 : room.quizData.questions.length,
          isReady: p.isReady || false
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      questionIndex: currentQuestionOnly ? room.currentQuestion : null,
      participants,
      totalParticipants: participants.length,
      timestamp: new Date()
    };
  }

  /**
   * Get room results
   * @param {string} roomCode - Room code
   * @returns {object} Results data
   */
  getRoomResults(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const participants = Array.from(room.participants.values())
      .map(p => ({
        playerId: p.playerId,
        name: p.name,
        score: p.score,
        totalQuestions: room.quizData.questions.length,
        answers: p.answers
      }))
      .sort((a, b) => b.score - a.score);

    return {
      gameSessionId: room.gameSessionId,
      quizTitle: room.quizData.title,
      totalQuestions: room.quizData.questions.length,
      participants,
      completedAt: new Date()
    };
  }

  /**
   * Save quiz results to database
   * @param {string} roomCode - Room code
   */
  async saveQuizResults(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    try {
      const participants = Array.from(room.participants.entries());
      
      for (const [socketId, participant] of participants) {
        const answer = new Answer({
          userId: socketId, // In a real app, you'd have user IDs
          quizId: room.quizId,
          roomCode,
          responses: participant.answers,
          totalScore: participant.score,
          totalQuestions: room.quizData.questions.length
        });

        await answer.save();
      }

      console.log(`Quiz results saved for room ${roomCode}`);
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  }

  /**
   * Check if a socket is the host of a room
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID
   * @returns {boolean} True if socket is host
   */
  isHost(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    
    // Find participant with this socketId
    const participant = room.participants.get(socketId);
    if (!participant) return false;
    
    // The host is the participant with the smallest joinedAt timestamp
    // or the first participant in the Map (since Map maintains insertion order)
    const participants = Array.from(room.participants.entries());
    if (participants.length === 0) return false;
    
    // Get the first participant (host)
    const [firstSocketId, firstParticipant] = participants[0];
    return socketId === firstSocketId;
  }

  /**
   * Cancel a room (host left)
   * @param {string} roomCode - Room code
   */
  cancelRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    
    this.clearQuestionTimer(roomCode);
    this.rooms.delete(roomCode);
    console.log(`Room ${roomCode} cancelled by host`);
  }

  /**
   * Delete a room
   * @param {string} roomCode - Room code
   */
  deleteRoom(roomCode) {
    this.clearQuestionTimer(roomCode);
    this.rooms.delete(roomCode);
    console.log(`Room ${roomCode} deleted`);
  }

  /**
   * Check if a participant is the host of a room
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID to check
   * @returns {boolean} True if the participant is the host
   */
  isHost(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const participant = room.participants.get(socketId);
    if (!participant) return false;

    // The host is the participant with the smallest joinedAt timestamp
    // or the first participant in the Map (since Map maintains insertion order)
    const participants = Array.from(room.participants.entries());
    if (participants.length === 0) return false;

    // Get the first participant (host)
    const [firstSocketId, firstParticipant] = participants[0];
    return socketId === firstSocketId;
  }

  /**
   * Get all active rooms (for debugging)
   * @returns {Array} List of active rooms
   */
  getActiveRooms() {
    return Array.from(this.rooms.keys());
  }
}

module.exports = new RoomService();
