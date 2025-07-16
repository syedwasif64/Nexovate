// services/faq.service.js
const sql = require('mssql');
const dbConfig = require('../config/database');

const getActiveFAQs = async () => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().execute('sp_GetActiveFAQs');
    return result.recordset;
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    throw err;
  }
};

module.exports = {
  getActiveFAQs,
};
