const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const documentService = require('../services/document.service');
const questionService = require('../services/question.service');

async function generatePDF(req, res) {
  try {
    const userId = req.user.UserID;
    const { responses, templates } = await questionService.getFinalizedResponsesWithTemplate(userId);

    if (!responses || responses.length === 0) {
      return res.status(400).json({ error: "Please finalize your questionnaire first." });
    }

    const jsonInput = {
      userId,
      answers: responses.reduce((acc, r) => {
        acc[r.QuestionText] = r.AnswerText;
        return acc;
      }, {}),
      extraNotes: req.body.extraNotes || "",
      imageLinks: templates.map(t => t.ImageURL)
    };

    const tmpFilePath = path.join(os.tmpdir(), `fyp_input_${userId}.json`);
    fs.writeFileSync(tmpFilePath, JSON.stringify(jsonInput, null, 2), 'utf-8');

    const pythonScriptPath = path.join(__dirname, '../../../ai-recommendation-test/generate_recommendation.py');
    const pythonProcess = spawn('python', [pythonScriptPath, tmpFilePath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('Python error:', stderr);
        return res.status(500).json({ error: 'PDF generation failed', details: stderr });
      }

      const pdfPath = stdout.trim();
      if (!fs.existsSync(pdfPath)) {
        return res.status(500).json({ error: 'PDF not found after generation' });
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      const fileName = await documentService.saveGeneratedDocument(userId, pdfBuffer);

      // ✅ Clear questionnaire & templates after successful generation
      await questionService.clearUserData(userId);

      res.json({
        success: true,
        fileName,
        downloadUrl: `/documents/download/${fileName}`
      });
    });

  } catch (error) {
    console.error('generatePDF error:', error);
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
}

async function downloadDocument(req, res) {
  try {
    const userId = req.user.UserID;
    const fileName = req.params.fileName;
    const documents = await documentService.getUserDocuments(userId);

    const doc = documents.find(d => d.FileName === fileName);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    res.download(doc.FilePath, doc.FileName, (err) => {
      if (err) console.error('Download failed:', err);
    });

  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

async function listDocuments(req, res) {
  try {
    const userId = req.user.UserID;
    const docs = await documentService.getUserDocuments(userId);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  generatePDF,
  downloadDocument,
  listDocuments
};
