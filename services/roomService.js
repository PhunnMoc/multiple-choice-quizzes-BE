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
        participants: new Map(), // socketId => { name, answers: [], score: 0 }
        currentQuestion: 0,
        quizData: quiz,
        isActive: false,
        isCompleted: false,
        startTime: null,
        questionStartTime: null
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

    // Check if user already in room
    if (room.participants.has(socketId)) {
      throw new Error('Already joined this room');
    }

    // Add participant
    room.participants.set(socketId, {
      name,
      answers: [],
      score: 0,
      joinedAt: new Date()
    });

    console.log(`User ${name} joined room ${roomCode}`);
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

    room.isActive = true;
    room.startTime = new Date();
    room.currentQuestion = 0;
    room.questionStartTime = new Date();

    // Start timer for first question
    this.startQuestionTimer(roomCode);

    console.log(`Quiz started in room ${roomCode}`);
    return room;
  }

  /**
   * Submit an answer
   * @param {string} roomCode - Room code
   * @param {string} socketId - Socket ID
   * @param {number} answer - Answer index (0-3)
   */
  submitAnswer(roomCode, socketId, answer) {
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
    const timeSpent = Date.now() - room.questionStartTime.getTime();

    // Add answer
    participant.answers.push({
      questionIndex: room.currentQuestion,
      answer,
      isCorrect,
      timeSpent
    });

    // Update score
    if (isCorrect) {
      participant.score++;
    }

    console.log(`Answer submitted in room ${roomCode}: ${answer} (${isCorrect ? 'correct' : 'incorrect'})`);
    return { isCorrect, timeSpent };
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
    }, 30000); // 30 seconds

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
      timeRemaining: this.getTimeRemaining(roomCode)
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
    return Math.max(0, 30000 - elapsed); // 30 seconds
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
        name: p.name,
        score: p.score,
        totalQuestions: room.quizData.questions.length,
        answers: p.answers
      }))
      .sort((a, b) => b.score - a.score);

    return {
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
   * Delete a room
   * @param {string} roomCode - Room code
   */
  deleteRoom(roomCode) {
    this.clearQuestionTimer(roomCode);
    this.rooms.delete(roomCode);
    console.log(`Room ${roomCode} deleted`);
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
