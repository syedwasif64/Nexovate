const express = require('express');
const router = express.Router();
const questionController = require('../controllers/question.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const questionValidators = require('../middlewares/question.validator');
const validationMiddleware = require('../middlewares/validation.middleware');

router.get('/',
  authenticate,
  questionController.getQuestions
);

router.post('/responses',
  authenticate,
  questionValidators.saveResponse,
  validationMiddleware,
  questionController.saveResponse
);

router.get('/progress',
  authenticate,
  questionController.getProgress
);

router.post('/finalize',
  authenticate,
  questionValidators.finalizeResponses,
  validationMiddleware,
  questionController.finalizeResponses
);

module.exports = router;
