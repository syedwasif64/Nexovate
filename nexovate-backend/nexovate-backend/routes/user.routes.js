// user.routes.js
const express = require('express');
const router = express.Router();

// Add your user routes here later
router.get('/', (req, res) => {
  res.json({ message: "User routes working" });
});

module.exports = router;