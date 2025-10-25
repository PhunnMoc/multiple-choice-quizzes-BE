const mongoose = require('mongoose');

const QuizHistorySchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  quizTitle: {
    type: String,
    required: true
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  participants: [{
    playerId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    answers: [{
      questionIndex: {
        type: Number,
        required: true
      },
      answerIndex: {
        type: Number,
        required: true
      },
      isCorrect: {
        type: Boolean,
        required: true
      },
      timeSpent: {
        type: Number,
        required: true
      },
      submittedAt: {
        type: Date,
        required: true
      }
    }]
  }],
  questions: [{
    questionIndex: {
      type: Number,
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    options: [{
      type: String,
      required: true
    }],
    correctAnswerIndex: {
      type: Number,
      required: true
    }
  }],
  completionTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('QuizHistory', QuizHistorySchema);
