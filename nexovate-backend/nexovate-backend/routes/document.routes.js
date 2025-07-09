const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/generate', authenticate, documentController.generatePDF);
router.get('/download/:fileName', authenticate, documentController.downloadDocument);
router.get('/', authenticate, documentController.listDocuments);

module.exports = router;
