const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const documentService = require('../services/document.service');
const questionService = require('../services/question.service');

async function generatePDF(req, res) {
  try {
    const userId = req.user.UserID;
    let textToGeneratePDF = null;
    let imageTemplates = [];
    let projectTitle = "Project Recommendation"; // Default title

    // Fetch responses and templates first, as we need ProjectName from here
    const { responses, templates } = await questionService.getFinalizedResponsesWithTemplate(userId);

    if (!responses || responses.length === 0) {
      return res.status(400).json({ error: "Please finalize your questionnaire first." });
    }

    // Extract ProjectName from the responses.
    // The SQL SP should now include ProjectName in the first result set.
    const projectNameResponse = responses.find(r => r.QuestionID === 1001); // Assuming 1001 is your project name QID
    if (projectNameResponse && projectNameResponse.AnswerText) {
      projectTitle = projectNameResponse.AnswerText;
    }

    // Option 1: Use refinedText passed directly in the body (highest priority)
    if (req.body.refinedText) {
      console.log("Generating PDF from text provided in request body.");
      textToGeneratePDF = req.body.refinedText;
      // If templates are explicitly provided in body, use them, otherwise use fetched templates
      if (req.body.templates && Array.isArray(req.body.templates)) {
        imageTemplates = req.body.templates.map(t => t.ImageURL);
      } else {
        imageTemplates = templates.map(t => t.ImageURL); // Use templates fetched from DB
      }
    } else {
      // Option 2: Try to get refined text from the database (most common scenario after draft/refinement)
      textToGeneratePDF = await documentService.getUserRecommendationDraft(userId);

      if (!textToGeneratePDF) {
        // Option 3: If no refined text in DB, generate fresh from questionnaire answers
        console.log("No refined text found in DB, generating fresh from questionnaire.");

        const jsonInput = {
          userId,
          answers: responses.reduce((acc, r) => {
            acc[r.QuestionText] = r.AnswerText;
            return acc;
          }, {}),
          extraNotes: req.body.extraNotes || "",
          imageLinks: templates.map(t => t.ImageURL)
        };

        // Call generateDraftText. This function now also saves the generated draft to the DB.
        textToGeneratePDF = await documentService.generateDraftText(jsonInput);
        imageTemplates = templates.map(t => t.ImageURL);
      } else {
        // If text was found in DB, use the templates fetched from the questionnaire service
        console.log("Using refined text from DB.");
        imageTemplates = templates.map(t => t.ImageURL);
      }
    }

    if (!textToGeneratePDF) {
      return res.status(500).json({ error: "No text available to generate PDF." });
    }

    const pdfBuffer = await documentService.generatePDFFromText(
      textToGeneratePDF,
      imageTemplates,
      projectTitle // <--- Pass the extracted project title
    );

    const fileName = await documentService.saveGeneratedDocument(userId, pdfBuffer);

    // >>> NEW: Clear user's questionnaire data after successful document generation <<<
    await documentService.clearUserQuestionnaireData(userId);
    // >>> END NEW <<<

    res.json({
      success: true,
      fileName,
      downloadUrl: `/documents/download/${fileName}`
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

async function generateDraftText(req, res) {
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

    const rawText = await documentService.generateDraftText(jsonInput);

    res.json({
      success: true,
      rawText
    });
  } catch (error) {
    console.error('generateDraftText error:', error);
    res.status(500).json({ error: 'Failed to generate draft text', details: error.message });
  }
}

async function refineDraftText(req, res) {
  try {
    const { existingText, modifications } = req.body;
    const userId = req.user.UserID;

    const refinedText = await documentService.refineDraftText(
      userId,
      existingText,
      modifications
    );

    res.json({
      success: true,
      refinedText
    });
  } catch (error) {
    console.error('refineDraftText error:', error);
    res.status(500).json({ error: 'Failed to refine draft', details: error.message });
  }
}

module.exports = {
  generatePDF,
  downloadDocument,
  listDocuments,
  generateDraftText,
  refineDraftText
};