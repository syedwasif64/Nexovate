const jwt = require('jsonwebtoken');
const handleError = require('./error.middleware');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return handleError(new Error('Authentication token missing'), req, res, next);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return handleError(new Error('Invalid or expired token'), req, res, next);
    }

    console.log("Decoded token:", decoded);

    // Standardize the user ID property
    req.user = {
     UserID: decoded.UserID// Ensure this matches your JWT payload
    };
    
    console.log("Authenticated User:", req.user); // Debug log
    next();
  });
}

module.exports = {
  authenticate
};