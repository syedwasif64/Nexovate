require('dotenv').config();
const sql = require('mssql');
const retry = require('async-retry');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

let pool;
let isConnecting = false;

async function getPool() {
  if (pool && pool.connected) return pool;
  if (isConnecting) await new Promise(resolve => setTimeout(resolve, 1000));
  
  isConnecting = true;
  try {
    pool = new sql.ConnectionPool(config);
    pool.on('error', err => {
      console.error('Pool error:', err);
      pool = null;
    });

    await retry(async (bail) => {
      try {
        await pool.connect();
        console.log('✅ Database connected');
        isConnecting = false;
        return pool;
      } catch (err) {
        if (err.code === 'ELOGIN') bail(err);
        throw err;
      }
    }, {
      retries: 5,
      minTimeout: 2000
    });

    return pool;
  } catch (err) {
    isConnecting = false;
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
}

async function execute(procedureName, params = []) {
  const pool = await getPool();
  try {
    const request = pool.request();
    params.forEach(p => request.input(p.name, p.type, p.value));
    
    const result = await request.execute(procedureName);
    return {
      recordset: result.recordset || [],
      recordsets: result.recordsets || [],
      output: result.output || {},
      rowsAffected: result.rowsAffected || [0]
    };
  } catch (err) {
    console.error('Procedure execution failed:', {
      procedure: procedureName,
      error: err.message
    });
    throw err;
  }
}

// Health check
setInterval(async () => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
  } catch (err) {
    console.error('Connection health check failed');
  }
}, 300000);

module.exports = {
  sql,
  config,
  execute,
  query: async (sql, params) => {
    const pool = await getPool();
    const request = pool.request();
    params.forEach(p => request.input(p.name, p.type, p.value));
    return request.query(sql);
  }
};