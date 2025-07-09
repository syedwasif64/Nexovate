const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { check } = require('express-validator');
const validationMiddleware = require('../middlewares/validation.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const authService = require('../services/auth.service');


router.post('/register', [
  check('fullName').notEmpty().withMessage('Full name is required'),
  check('email').isEmail().withMessage('Valid email is required'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validationMiddleware, authController.register);

router.post('/login', [
  check('email').isEmail().withMessage('Valid email is required'),
  check('password').notEmpty().withMessage('Password is required')
], validationMiddleware, authController.login);

router.get('/verify-email', [
  check('token').notEmpty().withMessage('Token is required')
], validationMiddleware, authController.verifyEmail);

router.post('/forgot-password', [
  check('email').isEmail().withMessage('Valid email is required')
], validationMiddleware, authController.forgotPassword);

// Add this GET route for testing email links
router.get('/reset-password', [
  check('token').notEmpty().withMessage('Token is required')
], validationMiddleware, (req, res) => {
  // Just return a success message with the token for testing
  res.json({ 
    message: 'Token is valid. Use POST /api/auth/reset-password with this token and newPassword in the body to reset password.',
    token: req.query.token 
  });
});

router.post('/reset-password', [
  check('token').notEmpty().withMessage('Token is required'),
  check('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], validationMiddleware, authController.resetPassword);


router.post('/change-password', [
  authenticate,
  check('currentPassword').notEmpty().withMessage('Current password is required'),
  check('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  })
], validationMiddleware, authController.changePassword);

router.post('/change-email', [
  authenticate,
  check('newEmail').isEmail().withMessage('Valid email is required'),
  check('confirmEmail').custom((value, { req }) => {
    if (value !== req.body.newEmail) {
      throw new Error('Email confirmation does not match new email');
    }
    return true;
  })
], validationMiddleware, authController.changeEmail);


router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;

router.post('/resend-verification', [
  check('token').notEmpty().withMessage('Token is required')
], validationMiddleware, async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await authService.resendVerification(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
