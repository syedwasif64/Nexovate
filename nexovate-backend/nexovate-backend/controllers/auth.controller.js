const authService = require('../services/auth.service');
const handleError = require('../middlewares/error.middleware');

async function register(req, res, next) {
  try {
    const { fullName, email, password } = req.body;
    const result = await authService.register(fullName, email, password);
    res.status(201).json({ 
      success: true, 
      message: result.message,
      userId: result.userId
    });
  } catch (error) {
    handleError(error, req, res, next);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    handleError(error, req, res, next);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    await authService.verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    handleError(error, req, res, next);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    handleError(error, req, res, next);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    handleError(error, req, res, next);
  }
}


async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.UserID, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    handleError(error, req, res, next);
  }
}

async function changeEmail(req, res, next) {
  try {
    console.log('req.user:', req.user); // For debugging
    await authService.changeEmail(req.user.UserID, req.body.newEmail);
    res.json({ 
      message: 'Email changed successfully. Please verify your new email.' 
    });
  } catch (error) {
    handleError(error, req, res, next);
  }
}


async function getCurrentUser(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.UserID);
    res.json(user);
  } catch (error) {
    handleError(error, req, res, next);
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  changeEmail,
  getCurrentUser
};