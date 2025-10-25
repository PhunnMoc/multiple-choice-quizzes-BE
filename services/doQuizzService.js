const Quiz = require('../models/Quiz');
const QuizHistory = require('../models/QuizHistory');

/**
 * Do Quiz Service
 * Handles quiz execution logic including questions, timing, and scoring
 */
class DoQuizService {
  constructor() {
    // Active quiz sessions
    // Structure: roomCode => { currentQuestion, questions, startTime, participants, timer }
    this.activeQuizzes = new Map();
    
    // Question timers
    this.questionTimers = new Map();
  }

  /**
   * Start a quiz for a room
   * @param {string} roomCode - Room code
   * @param {object} quizData - Quiz data from room
   * @param {Map} participants - Participants map
   * @returns {object} Quiz session data
   */
  /**
   * Start a quiz for a room
   * @param {string} roomCode - Room code
   * @param {object} quizData - Quiz data from room
   * @param {Map} participants - Participants map
   * @param {object} io - Socket.io instance for emitting events
   * @returns {object} Quiz session data
   */
  startQuiz(roomCode, quizData, participants, io = null) {
    try {
      console.log(`🎮 Starting quiz for room ${roomCode}:`, {
        quizData: quizData ? {
          _id: quizData._id,
          title: quizData.title,
          questionsCount: quizData.questions?.length || 0
        } : null,
        participantsCount: participants?.size || 0
      });

      // Initialize quiz session
      const quizSession = {
        roomCode,
        quizId: quizData._id,
        quizTitle: quizData.title,
        questions: quizData.questions,
        totalQuestions: quizData.questions.length,
        currentQuestionIndex: 0,
        startTime: new Date(),
        questionStartTime: null,
        participants: new Map(participants), // Copy participants
        isActive: true,
        isCompleted: false,
        questionDuration: 10000, // 10 seconds per question
        results: {
          scores: new Map(),
          answers: new Map(),
          completionTime: null
        }
      };

      this.activeQuizzes.set(roomCode, quizSession);

      // Start first question
      this.startQuestion(roomCode, io);

      console.log(`🎮 Quiz started for room ${roomCode} with ${quizData.questions.length} questions`);
      return quizSession;
    } catch (error) {
      console.error('Error starting quiz:', error);
      throw error;
    }
  }

  /**
   * Start a question (with timer)
   * @param {string} roomCode - Room code
   * @param {object} io - Socket.io instance for emitting events
   */
  startQuestion(roomCode, io = null) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      console.error(`Quiz session not found for room ${roomCode}`);
      return;
    }

    if (quizSession.currentQuestionIndex >= quizSession.totalQuestions) {
      this.endQuiz(roomCode);
      return;
    }

    // Set question start time
    quizSession.questionStartTime = new Date();
    
    // Clear existing timer
    this.clearQuestionTimer(roomCode);

    // Set timer for current question
    const timer = setTimeout(() => {
      console.log(`⏰ Time up for question ${quizSession.currentQuestionIndex + 1} in room ${roomCode}`);
      this.nextQuestion(roomCode, io);
    }, quizSession.questionDuration);

    this.questionTimers.set(roomCode, timer);

    console.log(`📝 Question ${quizSession.currentQuestionIndex + 1} started for room ${roomCode}`);
  }

  /**
   * Move to next question
   * @param {string} roomCode - Room code
   * @param {object} io - Socket.io instance for emitting events
   * @returns {object} Next question data or null if quiz ended
   */
  nextQuestion(roomCode, io = null) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      console.error(`Quiz session not found for room ${roomCode}`);
      return null;
    }

    // Clear current timer
    this.clearQuestionTimer(roomCode);

    // Save "no answer" for participants who didn't submit
    this.saveNoAnswerForCurrentQuestion(roomCode);

    // Move to next question
    quizSession.currentQuestionIndex++;

    if (quizSession.currentQuestionIndex >= quizSession.totalQuestions) {
      // Quiz completed
      const finalResults = this.endQuiz(roomCode);
      
      if (io) {
        io.to(roomCode).emit('quiz-completed', {
          results: finalResults,
          message: 'Quiz completed successfully'
        });
      }
      
      return null;
    }

    // Start next question
    this.startQuestion(roomCode, io);

    const nextQuestion = this.getCurrentQuestion(roomCode);
    const leaderboard = this.getLeaderboard(roomCode);

    // Emit next-question event to all participants
    if (io) {
      io.to(roomCode).emit('next-question', {
        question: nextQuestion,
        participantCount: leaderboard.length,
        leaderboard: leaderboard
      });
      
      console.log(`📝 Next question event emitted for room ${roomCode}`);
    }

    return nextQuestion;
  }

  /**
   * Get current question data
   * @param {string} roomCode - Room code
   * @returns {object} Current question data
   */
  getCurrentQuestion(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      console.error(`Quiz session not found for room ${roomCode}`);
      return null;
    }

    const question = quizSession.questions[quizSession.currentQuestionIndex];
    if (!question) {
      console.error(`Question not found at index ${quizSession.currentQuestionIndex} for room ${roomCode}`);
      return null;
    }

    // Calculate time remaining
    const timeRemaining = this.getTimeRemaining(roomCode);

    console.log(`📝 Getting question ${quizSession.currentQuestionIndex + 1} for room ${roomCode}:`, {
      questionText: question.questionText,
      options: question.options,
      timeRemaining: timeRemaining
    });

    return {
      questionIndex: quizSession.currentQuestionIndex,
      questionText: question.questionText,
      options: question.options,
      timeRemaining: timeRemaining,
      totalQuestions: quizSession.totalQuestions,
      startAt: quizSession.questionStartTime?.getTime() || Date.now(),
      duration: quizSession.questionDuration
    };
  }

  /**
   * Submit an answer for a participant
   * @param {string} roomCode - Room code
   * @param {string} participantId - Participant socket ID
   * @param {number} answerIndex - Answer index (0-3)
   * @returns {object} Answer result
   */
  submitAnswer(roomCode, participantId, answerIndex) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      throw new Error('Quiz session not found');
    }

    if (!quizSession.isActive) {
      throw new Error('Quiz is not active');
    }

    const participant = quizSession.participants.get(participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex];
    
    console.log(`📝 SubmitAnswer called for ${participant.name}:`, {
      roomCode: roomCode,
      participantId: participantId,
      currentQuestionIndex: quizSession.currentQuestionIndex,
      answerIndex: answerIndex,
      questionText: currentQuestion.questionText,
      correctAnswerIndex: currentQuestion.correctAnswerIndex
    });
    if (!currentQuestion) {
      throw new Error('No active question');
    }

    // Check if already answered this question
    const participantAnswers = quizSession.results.answers.get(participant.playerId) || [];
    const existingAnswer = participantAnswers.find(a => a.questionIndex === quizSession.currentQuestionIndex);
    
    console.log(`🔍 Checking existing answers for ${participant.name}:`, {
      participantId: participantId,
      playerId: participant.playerId,
      currentQuestionIndex: quizSession.currentQuestionIndex,
      existingAnswers: participantAnswers.map(a => ({ q: a.questionIndex, a: a.answerIndex })),
      hasExistingAnswer: !!existingAnswer
    });
    
    if (existingAnswer) {
      throw new Error('Already answered this question');
    }

    // Calculate time spent
    const timeSpent = Date.now() - quizSession.questionStartTime.getTime();
    
    // Check if answer is correct
    const isCorrect = answerIndex === currentQuestion.correctAnswerIndex;
    
    // Update score
    const currentScore = quizSession.results.scores.get(participant.playerId) || 0;
    const newScore = isCorrect ? currentScore + 1 : currentScore;
    quizSession.results.scores.set(participant.playerId, newScore);

    // Store answer
    const answerData = {
      questionIndex: quizSession.currentQuestionIndex,
      answerIndex: answerIndex,
      isCorrect: isCorrect,
      timeSpent: timeSpent,
      submittedAt: new Date()
    };

    participantAnswers.push(answerData);
    quizSession.results.answers.set(participant.playerId, participantAnswers);

    console.log(`📝 Stored answer for ${participant.name}:`, {
      questionIndex: quizSession.currentQuestionIndex,
      answerIndex: answerIndex,
      isCorrect: isCorrect,
      totalAnswers: participantAnswers.length,
      allAnswers: participantAnswers.map(a => ({ q: a.questionIndex, a: a.answerIndex, c: a.isCorrect }))
    });

    return {
      isCorrect: isCorrect,
      timeSpent: timeSpent,
      currentScore: newScore,
      participantId: participantId,
      participantName: participant.name
    };
  }

  /**
   * Get time remaining for current question
   * @param {string} roomCode - Room code
   * @returns {number} Time remaining in milliseconds
   */
  getTimeRemaining(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession || !quizSession.questionStartTime) {
      return 0;
    }

    const elapsed = Date.now() - quizSession.questionStartTime.getTime();
    return Math.max(0, quizSession.questionDuration - elapsed);
  }

  /**
   * Get leaderboard for current room
   * @param {string} roomCode - Room code
   * @returns {Array} Leaderboard data
   */
  getLeaderboard(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      return [];
    }

    const leaderboard = Array.from(quizSession.participants.values())
      .map(participant => {
        const score = quizSession.results.scores.get(participant.playerId) || 0;
        return {
          playerId: participant.playerId,
          name: participant.name,
          score: score,
          totalQuestions: quizSession.totalQuestions
        };
      })
      .sort((a, b) => b.score - a.score);

    return leaderboard;
  }

  /**
   * End quiz and calculate final results
   * @param {string} roomCode - Room code
   * @returns {object} Final results
   */
  endQuiz(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) {
      console.error(`Quiz session not found for room ${roomCode}`);
      return null;
    }

    // Clear timer
    this.clearQuestionTimer(roomCode);

    // Mark as completed
    quizSession.isActive = false;
    quizSession.isCompleted = true;
    quizSession.results.completionTime = new Date();

    // Calculate detailed results for each participant
    const participants = Array.from(quizSession.participants.values()).map(participant => {
      const score = quizSession.results.scores.get(participant.playerId) || 0;
      const answers = quizSession.results.answers.get(participant.playerId) || [];
      
      console.log(`📊 Final results for ${participant.name}:`, {
        playerId: participant.playerId,
        score: score,
        answersCount: answers.length,
        answers: answers.map(a => ({ q: a.questionIndex, a: a.answerIndex, c: a.isCorrect }))
      });
      
      return {
        playerId: participant.playerId,
        name: participant.name,
        score: score,
        totalQuestions: quizSession.totalQuestions,
        answers: answers
      };
    });

    const finalResults = {
      roomCode: roomCode,
      quizTitle: quizSession.quizTitle,
      totalQuestions: quizSession.totalQuestions,
      participants: participants,
      questions: quizSession.questions, // Add questions data
      completionTime: quizSession.results.completionTime,
      duration: Date.now() - quizSession.startTime.getTime()
    };

    // Save to history
    this.saveQuizHistory(finalResults, quizSession);

    // Clean up
    this.activeQuizzes.delete(roomCode);

    return finalResults;
  }

  /**
   * Save quiz results to history
   * @param {object} finalResults - Final quiz results
   * @param {object} quizSession - Quiz session data
   */
  async saveQuizHistory(finalResults, quizSession) {
    try {
      // Find host (first participant)
      const hostParticipant = Array.from(quizSession.participants.values())[0];
      
      const historyData = {
        roomCode: finalResults.roomCode,
        quizId: quizSession.quizId,
        quizTitle: finalResults.quizTitle,
        hostId: hostParticipant.playerId,
        hostName: hostParticipant.name,
        participants: finalResults.participants,
        questions: finalResults.questions,
        completionTime: finalResults.completionTime,
        duration: finalResults.duration
      };

      const history = new QuizHistory(historyData);
      await history.save();
      
      console.log(`📚 Quiz history saved for room ${finalResults.roomCode}`);
    } catch (error) {
      console.error('Error saving quiz history:', error);
    }
  }

  /**
   * Save "no answer" for participants who didn't submit current question
   * @param {string} roomCode - Room code
   */
  saveNoAnswerForCurrentQuestion(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    if (!quizSession) return;

    const currentQuestionIndex = quizSession.currentQuestionIndex;
    const currentQuestion = quizSession.questions[currentQuestionIndex];
    
    console.log(`💾 Saving no-answer for question ${currentQuestionIndex + 1}:`, {
      questionText: currentQuestion.questionText,
      participantsCount: quizSession.participants.size
    });

    // Check each participant
    for (const [participantId, participant] of quizSession.participants) {
      const participantAnswers = quizSession.results.answers.get(participant.playerId) || [];
      const existingAnswer = participantAnswers.find(a => a.questionIndex === currentQuestionIndex);
      
      if (!existingAnswer) {
        // Save "no answer" for this participant
        const noAnswerData = {
          questionIndex: currentQuestionIndex,
          answerIndex: -1, // -1 means no answer
          isCorrect: false,
          timeSpent: quizSession.questionDuration, // Full time spent
          submittedAt: new Date()
        };
        
        participantAnswers.push(noAnswerData);
        quizSession.results.answers.set(participant.playerId, participantAnswers);
        
        console.log(`💾 Saved no-answer for ${participant.name} on question ${currentQuestionIndex + 1}`);
      }
    }
  }

  /**
   * Clear question timer
   * @param {string} roomCode - Room code
   */
  clearQuestionTimer(roomCode) {
    const timer = this.questionTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.questionTimers.delete(roomCode);
    }
  }

  /**
   * Get quiz session data
   * @param {string} roomCode - Room code
   * @returns {object} Quiz session data
   */
  getQuizSession(roomCode) {
    return this.activeQuizzes.get(roomCode);
  }

  /**
   * Check if quiz is active for a room
   * @param {string} roomCode - Room code
   * @returns {boolean} True if quiz is active
   */
  isQuizActive(roomCode) {
    const quizSession = this.activeQuizzes.get(roomCode);
    return quizSession ? quizSession.isActive : false;
  }

  /**
   * Get all active quiz sessions (for debugging)
   * @returns {Array} List of active quiz sessions
   */
  getActiveQuizSessions() {
    return Array.from(this.activeQuizzes.keys());
  }
}

module.exports = new DoQuizService();
