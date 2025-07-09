require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql, config: dbConfig } = require('./config/database');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const questionRoutes = require('./routes/question.routes');
const userRoutes = require('./routes/user.routes');
const faqRoutes = require('./routes/faq.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test DB connection
app.get('/test-db', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT 1 AS test');
    res.json({ database: 'connected', result: result.recordset });
  } catch (err) {
    res.status(500).json({ database: 'connection failed', error: err.message });
  }
});


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/faqs', faqRoutes);

// Error handling
app.use(errorHandler);

// Database connection and server start
sql.connect(dbConfig)
  .then(pool => {
    console.log('✅ Connected to SQL Server');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

module.exports = app;