const { body } = require('express-validator');

module.exports = {
  saveResponse: [
    body('questionId')
      .isInt({ min: 1 })
      .withMessage('Question ID must be a positive integer'),
    body('answer')
      .notEmpty()
      .withMessage('Answer is required')
      .custom((value) => {
        const strVal = value.toString();
        const isNumber = /^\d+$/.test(strVal);
        const hasLetters = /[a-zA-Z]/.test(strVal);
        if (isNumber && hasLetters) {
          throw new Error('Answer cannot contain both numbers and letters.');
        }
        return true;
      })
  ],

  finalizeResponses: [
    body('selectedTemplateIds')
      .isArray({ min: 1 })
      .withMessage('At least one template must be selected'),
    body('selectedTemplateIds.*')
      .isInt({ min: 1 })
      .withMessage('Each template ID must be a valid positive integer')
  ]
};
