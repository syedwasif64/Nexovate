// database-seed.js
const { execute, initializePool } = require('./config/database');
const { seedQuestions } = require('./tests/setupQuestions');

async function setupDatabase() {
  try {
    // Initialize pool explicitly
    await initializePool();
    
    // Add delay to ensure connection is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await seedQuestions();
    console.log('✅ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    // Close connection after seeding
    const { pool } = require('./config/database');
    if (pool && pool.connected) {
      await pool.close();
    }
  }
}

setupDatabase();