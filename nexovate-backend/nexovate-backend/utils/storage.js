const fs = require('fs');
const path = require('path');

function ensureUploadsDir(userId) {
  const userDir = path.join(process.env.UPLOAD_DIR, `user_${userId}`);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

function saveFile(userId, fileName, buffer) {
  const userDir = ensureUploadsDir(userId);
  const filePath = path.join(userDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function getFile(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

module.exports = {
  saveFile,
  deleteFile,
  getFile
};