const nodemailer = require('nodemailer');
const path = require('path');

// For testing - uses ethereal.email
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'marielle30@ethereal.email',
    pass: 'jtxgbSRgmp9jj8a5Vf'
  }
});

async function sendVerificationEmail(email, verificationUrl) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Please click <a href="${verificationUrl}">here</a> to verify your email.</p>`
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

// In email.service.js
async function sendPasswordResetEmail(email, token) {
  const resetUrl = `http://localhost:3000/api/auth/reset-password?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <p>Click this link to verify your token: <a href="${resetUrl}">${resetUrl}</a></p>
      <p>Then use Postman to POST to ${resetUrl} with newPassword in the body.</p>
    `
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};