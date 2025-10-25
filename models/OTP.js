const mongoose = require('mongoose');

/**
 * OTP Schema
 * Stores OTP codes for email verification
 */
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    length: 6
  },
  type: {
    type: String,
    enum: ['signup', 'reset_password'],
    default: 'signup'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // Auto-delete expired OTPs
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  }
}, {
  timestamps: true
});

// Index for efficient queries
otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create OTP
otpSchema.statics.createOTP = async function(email, type = 'signup') {
  // Delete any existing OTPs for this email and type
  await this.deleteMany({ email, type });
  
  const code = this.generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  const otp = new this({
    email,
    code,
    type,
    expiresAt
  });
  
  return await otp.save();
};

// Method to verify OTP
otpSchema.methods.verifyOTP = async function(inputCode) {
  if (this.isUsed) {
    throw new Error('OTP has already been used');
  }
  
  if (this.expiresAt < new Date()) {
    throw new Error('OTP has expired');
  }
  
  if (this.attempts >= 3) {
    throw new Error('Too many attempts. Please request a new OTP');
  }
  
  this.attempts += 1;
  
  if (this.code !== inputCode) {
    await this.save();
    throw new Error('Invalid OTP code');
  }
  
  this.isUsed = true;
  await this.save();
  
  return true;
};

module.exports = mongoose.model('OTP', otpSchema);
