const mongoose = require('mongoose');
const questionSchema = require('./Question');

/**
 * Quiz Schema
 * Represents a complete quiz with multiple questions
 */
const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: [200, 'Quiz title cannot exceed 200 characters']
  },
  authorName: {
    type: String,
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters'],
    default: 'Anonymous'
  },
  questions: {
    type: [questionSchema],
    required: [true, 'Quiz must have at least one question'],
    validate: {
      validator: function(questions) {
        return questions.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

// Update the updatedAt field before saving
quizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
quizSchema.index({ title: 'text', authorName: 'text' });
quizSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
