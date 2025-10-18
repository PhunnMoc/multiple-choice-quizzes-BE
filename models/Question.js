const mongoose = require('mongoose');

/**
 * Question Schema - Embedded in Quiz model
 * Represents a single multiple choice question
 */
const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [500, 'Question text cannot exceed 500 characters']
  },
  options: {
    type: [String],
    required: [true, 'Question must have options'],
    validate: {
      validator: function(options) {
        return options.length === 4;
      },
      message: 'Question must have exactly 4 options'
    }
  },
  correctAnswerIndex: {
    type: Number,
    required: [true, 'Correct answer index is required'],
    min: [0, 'Correct answer index must be between 0 and 3'],
    max: [3, 'Correct answer index must be between 0 and 3']
  }
}, {
  _id: true // Ensure each question has its own ID
});

// Validate that correctAnswerIndex is within the options array bounds
questionSchema.pre('validate', function(next) {
  if (this.correctAnswerIndex >= this.options.length) {
    next(new Error('Correct answer index must be within the options array bounds'));
  } else {
    next();
  }
});

module.exports = questionSchema;
