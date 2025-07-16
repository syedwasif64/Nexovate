const { execute, sql } = require('../config/database');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function saveGeneratedDocument(userId, pdfBuffer) {
  const fileName = `doc_${userId}_${Date.now()}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.writeFileSync(filePath, pdfBuffer);

  await execute('sp_GenerateDocument', [
    { name: 'UserID', value: userId, type: sql.Int },
    { name: 'FileName', value: fileName, type: sql.NVarChar },
    { name: 'FilePath', value: filePath, type: sql.NVarChar }
  ]);

  return fileName;
}

async function getUserDocuments(userId) {
  const result = await execute('sp_GetUserDocuments', [
    { name: 'UserID', value: userId, type: sql.Int }
  ]);
  return result.recordset;
}

async function getUserRecommendationDraft(userId) {
  try {
    const result = await execute('sp_GetUserRecommendationDraft', [
      { name: 'UserID', value: userId, type: sql.Int }
    ]);
    return result.recordset[0] ? result.recordset[0].RefinedRecommendationText : null;
  } catch (error) {
    console.error('Error in getUserRecommendationDraft:', error);
    throw error;
  }
}

async function saveUserRecommendationDraft(userId, text) {
  try {
    await execute('sp_SaveUserRecommendationDraft', [
      { name: 'UserID', value: userId, type: sql.Int },
      { name: 'RecommendationText', value: text, type: sql.NVarChar }
    ]);
  } catch (error) {
    console.error('Error in saveUserRecommendationDraft:', error);
    throw error;
  }
}

// >>> NEW FUNCTION TO CLEAR USER DATA <<<
async function clearUserQuestionnaireData(userId) {
    try {
        await execute('sp_DeleteUserQuestionnaireData', [
            { name: 'UserID', value: userId, type: sql.Int }
        ]);
        console.log(`User questionnaire data cleared for UserID: ${userId}`);
    } catch (error) {
        console.error(`Error clearing user questionnaire data for UserID ${userId}:`, error);
        // It's up to you how critical this is. If the PDF generated, maybe don't block
        // the response, but log the error for investigation. Throwing will halt.
        throw error;
    }
}
// >>> END NEW FUNCTION <<<


async function generateDraftText(jsonInput) {
  const tmpFilePath = path.join(os.tmpdir(), `fyp_input_${jsonInput.userId}.json`);
  fs.writeFileSync(tmpFilePath, JSON.stringify(jsonInput, null, 2), 'utf-8');

  const pythonScriptPath = path.join(__dirname, '../../../ai-recommendation-test/generate_recommendation.py');
  const pythonProcess = spawn('python', [pythonScriptPath, tmpFilePath, '--draft-only']);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('Python error generating draft text:', stderr);
        fs.unlinkSync(tmpFilePath);
        return reject(new Error('Draft text generation failed'));
      }
      const draft = stdout.trim();
      try {
        await saveUserRecommendationDraft(jsonInput.userId, draft);
      } catch (dbError) {
        console.error('Failed to save initial draft to DB:', dbError);
      }
      fs.unlinkSync(tmpFilePath);
      resolve(draft);
    });
  });
}

// MODIFIED: Now accepts projectTitle for the Python script
async function generatePDFFromText(recommendationText, imageLinks, projectTitle = "Project Recommendation") {
  const tmpFilePath = path.join(os.tmpdir(), `fyp_final_${Date.now()}.json`);

  const jsonInput = {
    recommendation: recommendationText,
    imageLinks: imageLinks || [
      "https://i.postimg.cc/FHHzNfrZ/Desktop1.webp",
      "https://i.postimg.cc/dtTZgZ0T/Mob1.webp",
      "https://i.postimg.cc/vZ01Vrqk/Mob3.webp",
      "https://i.postimg.cc/j262dPn8/Mob2.webp",
      "https://i.postimg.cc/VvFscw2p/desktop3.webp",
      "https://i.postimg.cc/44vxcvnP/Desktop2.webp",
    ],
    projectTitle: projectTitle // <--- Passing projectTitle to Python
  };

  fs.writeFileSync(tmpFilePath, JSON.stringify(jsonInput, null, 2), 'utf-8');

  const pythonScriptPath = path.join(__dirname, '../../../ai-recommendation-test/generate_recommendation.py');
  const pythonProcess = spawn('python', [pythonScriptPath, tmpFilePath]);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', (code) => {
      fs.unlinkSync(tmpFilePath);

      if (code !== 0) {
        console.error('Python error generating PDF from text:', stderr);
        return reject(new Error('PDF generation failed'));
      }
      const pdfPath = stdout.trim();
      if (!fs.existsSync(pdfPath)) {
        return reject(new Error('PDF not found after generation'));
      }
      const pdfBuffer = fs.readFileSync(pdfPath);
      fs.unlinkSync(pdfPath);
      resolve(pdfBuffer);
    });
  });
}

async function refineDraftText(userId, existingText, modifications) {
  const tmpFilePath = path.join(os.tmpdir(), `fyp_refine_input_${userId}.json`);
  fs.writeFileSync(tmpFilePath, JSON.stringify({ userId }), 'utf-8');

  const pythonScriptPath = path.join(__dirname, '../../../ai-recommendation-test/generate_recommendation.py');
  const pythonProcess = spawn('python', [
    pythonScriptPath,
    tmpFilePath,
    '--draft-only',
    '--refine', existingText,
    '--modifications', modifications
  ]);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', async (code) => {
      fs.unlinkSync(tmpFilePath);

      if (code !== 0) {
        console.error('Python refinement error:', stderr);
        return reject(new Error('Draft refinement failed'));
      }
      const refined = stdout.trim();
      try {
        await saveUserRecommendationDraft(userId, refined);
      } catch (dbError) {
        console.error('Failed to save refined draft to DB:', dbError);
      }
      resolve(refined);
    });
  });
}

module.exports = {
  saveGeneratedDocument,
  getUserDocuments,
  generateDraftText,
  generatePDFFromText,
  refineDraftText,
  getUserRecommendationDraft,
  saveUserRecommendationDraft,
  clearUserQuestionnaireData // >>> NEW EXPORT <<<
};