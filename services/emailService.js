const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles sending emails including OTP verification
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    // For development, we'll use Gmail SMTP
    // In production, you should use a proper email service like SendGrid, AWS SES, etc.
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
      }
    });

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email transporter verification failed:', error);
      } else {
        console.log('✅ Email transporter is ready to send emails');
      }
    });
  }

  /**
   * Send OTP verification email
   * @param {string} email - Recipient email
   * @param {string} otpCode - OTP code
   * @param {string} type - Type of verification (signup, reset_password)
   * @returns {Promise<boolean>} Success status
   */
  async sendOTPEmail(email, otpCode, type = 'signup') {
    try {
      const subject = type === 'signup' 
        ? 'Verify Your Email - Quiz Platform' 
        : 'Reset Your Password - Quiz Platform';

      const htmlContent = this.generateOTPEmailHTML(otpCode, type);

      const mailOptions = {
        from: {
          name: 'Quiz Platform',
          address: process.env.EMAIL_USER || 'your-email@gmail.com'
        },
        to: email,
        subject: subject,
        html: htmlContent,
        text: `Your verification code is: ${otpCode}. This code will expire in 10 minutes.`
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ OTP email sent to ${email}:`, result.messageId);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Generate HTML content for OTP email
   * @param {string} otpCode - OTP code
   * @param {string} type - Type of verification
   * @returns {string} HTML content
   */
  generateOTPEmailHTML(otpCode, type) {
    const title = type === 'signup' ? 'Welcome to Quiz Platform!' : 'Password Reset Request';
    const message = type === 'signup' 
      ? 'Thank you for signing up! Please verify your email address to complete your registration.'
      : 'You requested to reset your password. Use the code below to proceed.';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 10px;
          }
          .otp-code {
            background-color: #f8f9fa;
            border: 2px dashed #4CAF50;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .otp-number {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
            letter-spacing: 5px;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎯 Quiz Platform</div>
            <h1>${title}</h1>
          </div>
          
          <p>${message}</p>
          
          <div class="otp-code">
            <p style="margin: 0 0 10px 0; color: #666;">Your verification code:</p>
            <div class="otp-number">${otpCode}</div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong>
            <ul style="margin: 10px 0;">
              <li>This code will expire in 10 minutes</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <div class="footer">
            <p>© 2024 Quiz Platform. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send welcome email after successful verification
   * @param {string} email - Recipient email
   * @param {string} name - User name
   * @returns {Promise<boolean>} Success status
   */
  async sendWelcomeEmail(email, name) {
    try {
      const mailOptions = {
        from: {
          name: 'Quiz Platform',
          address: process.env.EMAIL_USER || 'your-email@gmail.com'
        },
        to: email,
        subject: 'Welcome to Quiz Platform! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">Welcome to Quiz Platform, ${name}! 🎉</h1>
            <p>Your email has been successfully verified and your account is now active.</p>
            <p>You can now:</p>
            <ul>
              <li>Create and host quiz sessions</li>
              <li>Join quiz rooms with friends</li>
              <li>Track your quiz performance</li>
              <li>Explore our quiz library</li>
            </ul>
            <p>Happy quizzing! 🎯</p>
            <p>Best regards,<br>The Quiz Platform Team</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
