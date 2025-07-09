// faq.routes.js
const express = require('express');
const router = express.Router();

// Add your FAQ routes here later
router.get('/', (req, res) => {
  res.json({ message: "FAQ routes working" });
});

module.exports = router;