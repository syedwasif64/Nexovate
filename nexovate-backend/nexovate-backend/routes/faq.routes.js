// faq.routes.js
const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faq.controller');

router.get('/', faqController.getFAQs);

module.exports = router;
