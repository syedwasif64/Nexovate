const { execute, sql } = require('../config/database');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function saveGeneratedDocument(userId, pdfBuffer) {
  const fileName = `doc_${userId}_${Date.now()}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // 1. Save PDF to filesystem
  fs.writeFileSync(filePath, pdfBuffer);

  // 2. Save metadata to DB
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

module.exports = {
  saveGeneratedDocument,
  getUserDocuments
};
