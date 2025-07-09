// models/question.model.js
const { execute } = require('../config/database');

class QuestionModel {
  static async getActiveQuestions() {
    const result = await execute('sp_GetActiveQuestions');
    return result.recordset;
  }

  static async saveResponse(userId, questionId, selectedOptionId, customText) {
    await execute('sp_SaveUserResponse', [
      { name: 'UserID', value: userId },
      { name: 'QuestionID', value: questionId },
      { name: 'SelectedOptionID', value: selectedOptionId },
      { name: 'CustomText', value: customText }
    ]);
  }

  static async getProgress(userId) {
    const result = await execute('sp_GetUserProgress', [
      { name: 'UserID', value: userId }
    ]);
    return result.recordset[0];
  }
}

module.exports = QuestionModel;