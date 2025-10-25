const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');

/**
 * Authentication Controller
 * Handles user authentication operations
 */
class AuthController {
  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }

  /**
   * Register a new user
   * POST /api/auth/signup
   */
  signup = async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const user = new User({
        name,
        email,
        password
      });

      await user.save();

      // Generate JWT token
      const token = this.generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
          },
          token
        }
      });
    } catch (error) {
      console.error('Error in signup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Authenticate user and return JWT token
   * POST /api/auth/login
   */
  login = async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = this.generateToken(user._id);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
          },
          token
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  getProfile = async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Send OTP to email for verification
   * POST /api/auth/send-otp
   */
  sendOTP = async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create and send OTP
      const otp = await OTP.createOTP(email, 'signup');
      await emailService.sendOTPEmail(email, otp.code, 'signup');

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
        data: {
          email: email,
          expiresIn: '10 minutes'
        }
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
        error: error.message
      });
    }
  }

  /**
   * Verify OTP and complete registration
   * POST /api/auth/verify-otp
   */
  verifyOTP = async (req, res) => {
    try {
      const { email, otp, name, password } = req.body;

      // Find the OTP record
      const otpRecord = await OTP.findOne({ 
        email, 
        type: 'signup',
        isUsed: false 
      });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Verify OTP
      try {
        await otpRecord.verifyOTP(otp);
      } catch (otpError) {
        return res.status(400).json({
          success: false,
          message: otpError.message
        });
      }

      // Check if user already exists (double check)
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const user = new User({
        name,
        email,
        password,
        isEmailVerified: true,
        emailVerifiedAt: new Date()
      });

      await user.save();

      // Send welcome email
      await emailService.sendWelcomeEmail(email, name);

      // Generate JWT token
      const token = this.generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'Account created and verified successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt
          },
          token
        }
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Resend OTP to email
   * POST /api/auth/resend-otp
   */
  resendOTP = async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Check for recent OTP requests (rate limiting)
      const recentOTP = await OTP.findOne({
        email,
        type: 'signup',
        createdAt: { $gte: new Date(Date.now() - 60000) } // 1 minute ago
      });

      if (recentOTP) {
        return res.status(400).json({
          success: false,
          message: 'Please wait before requesting another OTP'
        });
      }

      // Create and send new OTP
      const otp = await OTP.createOTP(email, 'signup');
      await emailService.sendOTPEmail(email, otp.code, 'signup');

      res.status(200).json({
        success: true,
        message: 'OTP resent to your email',
        data: {
          email: email,
          expiresIn: '10 minutes'
        }
      });
    } catch (error) {
      console.error('Error resending OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
