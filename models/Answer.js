const mongoose = require('mongoose');

/**
 * Answer Schema
 * Represents a user's response to a quiz
 */
const answerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz ID is required']
  },
  roomCode: {
    type: String,
    required: [true, 'Room code is required'],
    trim: true
  },
  responses: [{
    questionIndex: {
      type: Number,
      required: true,
      min: 0
    },
    answer: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    timeSpent: {
      type: Number, // Time in milliseconds
      default: 0
    }
  }],
  totalScore: {
    type: Number,
    default: 0,
    min: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate total score before saving
answerSchema.pre('save', function(next) {
  if (this.responses && this.responses.length > 0) {
    this.totalScore = this.responses.filter(response => response.isCorrect).length;
  }
  next();
});

// Index for better query performance
answerSchema.index({ userId: 1, quizId: 1 });
answerSchema.index({ roomCode: 1 });
answerSchema.index({ completedAt: -1 });

// Ensure one answer per user per quiz per room
answerSchema.index({ userId: 1, quizId: 1, roomCode: 1 }, { unique: true });

module.exports = mongoose.model('Answer', answerSchema);
