const emailService = require('./email.service');
const { sql, config } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

async function register(fullName, email, password) {
  const pool = await sql.connect(config);
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(20).toString('hex');

  const request = pool.request();
  request.input('FullName', sql.NVarChar(100), fullName);
  request.input('Email', sql.NVarChar(100), email);
  request.input('PasswordHash', sql.NVarChar(255), hashedPassword);
  request.input('VerificationToken', sql.NVarChar(100), verificationToken);
  request.output('UserID', sql.Int);

  const result = await request.execute('sp_RegisterUser');
  const userId = result.output.UserID;

  console.log(`[Register] Generated token: ${verificationToken}`);

  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
  await emailService.sendVerificationEmail(email, verificationUrl);

  return {
    message: 'Registration successful. Please check your email to verify your account.',
    userId,
    verificationToken
  };
}

async function login(email, password) {
  const pool = await sql.connect(config);
  const request = pool.request();
  request.input('Email', sql.NVarChar(100), email);

  const result = await request.execute('sp_GetUserByEmail');
  const user = result.recordset[0];

  if (!user) throw new Error('Invalid email or password.');

  const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
  if (!passwordMatch) throw new Error('Invalid email or password.');

  if (!user.EmailVerified) {
    const error = new Error('Please verify your email before logging in.');
    error.code = 'EMAIL_NOT_VERIFIED';
    error.resendToken = user.EmailVerificationToken;
    throw error;
  }

  const token = jwt.sign(
    { UserID: user.UserID },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  return {
    token,
    user: { UserID: user.UserID, email: user.Email }
  };
}

async function verifyEmail(token) {
  const pool = await sql.connect(config);
  const request = pool.request();
  request.input('VerificationToken', sql.NVarChar(100), token);

  await request.execute('sp_VerifyEmail');
  return 'Email verified successfully';
}

async function resendVerification(token) {
  const pool = await sql.connect(config);

  const request = pool.request();
  request.input('VerificationToken', sql.NVarChar(100), token);

  const userResult = await request.query(`
    SELECT UserID, Email, EmailVerified 
    FROM Users 
    WHERE EmailVerificationToken = @VerificationToken
  `);

  const user = userResult.recordset[0];
  if (!user) throw new Error('Invalid or expired token.');
  if (user.EmailVerified) return { message: 'Email is already verified.' };

  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${token}`;
  await emailService.sendVerificationEmail(user.Email, verificationUrl);

  return { message: 'Verification email resent successfully.' };
}

async function forgotPassword(email) {
  const pool = await sql.connect(config);
  const resetToken = crypto.randomBytes(20).toString('hex');

  const request = pool.request();
  request.input('Email', sql.NVarChar(100), email);
  request.input('VerificationToken', sql.NVarChar(100), resetToken);
  request.output('Success', sql.Bit);
  request.output('Message', sql.NVarChar(255));

  const result = await request.execute('sp_RequestPasswordReset');

  if (!result.output.Success) throw new Error(result.output.Message || 'Failed to process password reset request');

  await emailService.sendPasswordResetEmail(email, resetToken);
  return { success: true, message: 'Password reset email sent. Please check your inbox.' };
}

async function resetPassword(token, newPassword) {
  const pool = await sql.connect(config);
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const request = pool.request();
  request.input('ResetToken', sql.NVarChar(100), token);
  request.input('NewPassword', sql.NVarChar(255), hashedPassword);
  request.output('Success', sql.Bit);
  request.output('Message', sql.NVarChar(255));

  const result = await request.execute('sp_ResetPassword');

  if (!result.output.Success) throw new Error(result.output.Message || 'Password reset failed');

  return { success: true, message: 'Password reset successfully.' };
}

async function changePassword(userId, currentPassword, newPassword) {
  const pool = await sql.connect(config);
  const userRequest = pool.request();
  userRequest.input('UserID', sql.Int, userId);

  const userResult = await userRequest.query(`
    SELECT UserID, PasswordHash 
    FROM Users 
    WHERE UserID = @UserID
  `);

  const user = userResult.recordset[0];
  if (!user) throw new Error('User account not found. Please try logging in again.');

  const passwordMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
  if (!passwordMatch) throw new Error('The current password you entered is incorrect.');
  if (currentPassword === newPassword) throw new Error('New password must be different from current password.');
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters long.');

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  const updateRequest = pool.request();
  updateRequest.input('UserID', sql.Int, userId);
  updateRequest.input('NewPassword', sql.NVarChar(255), hashedNewPassword);

  await updateRequest.execute('sp_ChangePassword');

  return { success: true, message: 'Password changed successfully.' };
}

async function changeEmail(userId, newEmail) {
  const pool = await sql.connect(config);

  const verificationToken = crypto.randomBytes(20).toString('hex');

  const request = pool.request();
  request.input('UserID', sql.Int, userId);
  request.input('NewEmail', sql.NVarChar(100), newEmail);
  request.input('VerificationToken', sql.NVarChar(100), verificationToken);
  request.output('Success', sql.Bit);
  request.output('Message', sql.NVarChar(255));

  const result = await request.execute('sp_ChangeEmail');
  if (!result.output.Success) throw new Error(result.output.Message || 'Failed to change email.');

  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;
  await emailService.sendVerificationEmail(newEmail, verificationUrl);

  return result.output.Message;
}

async function getCurrentUser(userId) {
  const pool = await sql.connect(config);
  const request = pool.request();
  request.input('UserID', sql.Int, userId);

  const result = await request.query(`
    SELECT UserID, FullName, Email, EmailVerified 
    FROM Users 
    WHERE UserID = @UserID
  `);

  if (!result.recordset[0]) throw new Error('User not found');
  return result.recordset[0];
}

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  changeEmail,
  getCurrentUser,
  resendVerification
};
