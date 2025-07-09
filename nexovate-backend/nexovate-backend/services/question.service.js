const { execute, sql, config } = require('../config/database');

async function getQuestionsWithOptions() {
  const results = await execute('sp_GetActiveQuestions');
  if (!results?.recordset) throw new Error('Invalid database response');

  const questionsMap = new Map();
  results.recordset.forEach((row) => {
    if (!row.QuestionID) return;
    if (!questionsMap.has(row.QuestionID)) {
      questionsMap.set(row.QuestionID, {
        id: row.QuestionID,
        text: row.QuestionText,
        type: row.QuestionType,
        options: []
      });
    }
    if (row.OptionID) {
      questionsMap.get(row.QuestionID).options.push({
        id: row.OptionID,
        text: row.OptionText,
        isCustom: row.IsCustomOption
      });
    }
  });
  return Array.from(questionsMap.values());
}

async function saveUserResponse(userId, questionId, answer) {
  const isOptionId = /^\d+$/.test(answer);
  await execute('sp_SaveUserResponse', [
    { name: 'UserID', value: userId, type: sql.Int },
    { name: 'QuestionID', value: questionId, type: sql.Int },
    { name: 'SelectedOptionID', value: isOptionId ? parseInt(answer) : null, type: sql.Int },
    { name: 'CustomText', value: isOptionId ? null : answer.toString(), type: sql.NVarChar }
  ]);
}

async function getUserProgress(userId) {
  const result = await execute('sp_GetUserProgress', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
  const progress = result.recordset[0];
  return {
    total: progress.TotalQuestions,
    answered: progress.AnsweredQuestions,
    percentage: Math.round((progress.AnsweredQuestions / progress.TotalQuestions) * 100)
  };
}

async function finalizeResponses(userId, selectedTemplateIds) {
  if (!Array.isArray(selectedTemplateIds) || selectedTemplateIds.length === 0) {
    const error = new Error('Template selection is required to finalize responses.');
    error.code = 'INVALID_TEMPLATE';
    throw error;
  }

  for (const templateId of selectedTemplateIds) {
    const exists = await templateExists(templateId);
    if (!exists) {
      const error = new Error(`Template with ID ${templateId} does not exist.`);
      error.code = 'TEMPLATE_NOT_FOUND';
      throw error;
    }
  }

  for (const templateId of selectedTemplateIds) {
    await saveSelectedTemplate(userId, templateId);
  }

  const completionResult = await execute('sp_CheckCompletion', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
  const unanswered = completionResult.recordset[0]?.UnansweredCount ?? 0;
  if (unanswered > 0) {
    const error = new Error(`Please answer all ${unanswered} required questions before finalizing.`);
    error.code = 'ERR_UNANSWERED_QUESTIONS';
    throw error;
  }

  await execute('sp_FinalizeResponses', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
}

async function isQuestionnaireFinalized(userId) {
  const result = await execute('sp_IsQuestionnaireFinalized', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
  return result.recordset[0]?.IsFinalized === true;
}

async function saveSelectedTemplate(userId, templateId) {
  await execute('sp_SaveUserTemplateSelection', [
    { name: 'UserID', value: userId, type: sql.Int },
    { name: 'TemplateID', value: templateId, type: sql.Int }
  ]);
}

async function templateExists(templateId) {
  const result = await execute('sp_TemplateExists', [
    { name: 'TemplateID', value: templateId, type: sql.Int }
  ]);
  return result.recordset[0]?.Exists === 1;
}

async function getFinalizedResponses(userId) {
  const result = await execute('sp_GetFinalizedResponses', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
  return result.recordset;
}

async function getFinalizedResponsesWithTemplate(userId) {
  const pool = await sql.connect(config);
  const request = pool.request();
  request.input('UserID', sql.Int, userId);

  const result = await request.execute('sp_GetFinalizedResponsesWithTemplate');
  const responses = result.recordsets[0];
  const templates = result.recordsets[1];

  return { responses, templates };
}

async function clearUserData(userId) {
  await execute('sp_ClearUserData', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
}

module.exports = {
  getQuestionsWithOptions,
  saveUserResponse,
  finalizeResponses,
  getUserProgress,
  isQuestionnaireFinalized,
  saveSelectedTemplate,
  templateExists,
  getFinalizedResponses,
  getFinalizedResponsesWithTemplate,
  clearUserData
};
