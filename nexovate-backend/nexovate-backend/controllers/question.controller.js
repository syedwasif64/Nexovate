const questionService = require('../services/question.service');

async function getQuestions(req, res) {
  try {
    const questions = await questionService.getQuestionsWithOptions();
    res.json(questions || []);
  } catch (error) {
    res.status(500).json({
      code: 'ERR_FETCH_QUESTIONS',
      message: 'Failed to fetch questions',
      details: error.message
    });
  }
}

async function saveResponse(req, res) {
  try {
    const { questionId, answer } = req.body;

    if (!questionId || answer === undefined) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Question ID and answer are required'
      });
    }

    const isFinalized = await questionService.isQuestionnaireFinalized(req.user.UserID);
    if (isFinalized) {
      return res.status(403).json({
        code: 'ALREADY_FINALIZED',
        message: 'Responses are already finalized and cannot be changed.'
      });
    }

    await questionService.saveUserResponse(req.user.UserID, questionId, answer);

    res.json({ code: 'RESPONSE_SAVED', message: 'Answer saved successfully.' });
  } catch (error) {
    console.error("Save response error:", error);
    res.status(500).json({
      code: 'ERR_SAVE_RESPONSE',
      message: 'Failed to save response',
      details: error.message
    });
  }
}

async function getProgress(req, res) {
  try {
    const progress = await questionService.getUserProgress(req.user.UserID);
    res.json(progress);
  } catch (error) {
    res.status(500).json({
      code: 'ERR_FETCH_PROGRESS',
      message: 'Failed to fetch progress',
      details: error.message
    });
  }
}

async function finalizeResponses(req, res) {
  try {
    const { selectedTemplateIds } = req.body;

    if (!Array.isArray(selectedTemplateIds) || selectedTemplateIds.length === 0) {
      return res.status(400).json({
        code: 'INVALID_TEMPLATE',
        message: 'Please select at least one template.'
      });
    }

    await questionService.finalizeResponses(req.user.UserID, selectedTemplateIds);

    res.json({
      code: 'RESPONSES_FINALIZED',
      message: 'Responses finalized and template selections saved successfully.'
    });
  } catch (error) {
    console.error("Finalization error:", error);
    res.status(500).json({
      code: 'ERR_FINALIZE_FAILED',
      message: 'Finalization failed',
      details: error.message
    });
  }
}

module.exports = {
  getQuestions,
  saveResponse,
  getProgress,
  finalizeResponses
};
