function handleError(error, req, res, next) {
  console.error(error);

  if (error.code === 'EMAIL_NOT_VERIFIED') {
    return res.status(403).json({
      code: error.code,
      message: error.message,
      resendToken: error.resendToken
    });
  }

  res.status(500).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
}

module.exports = handleError;
