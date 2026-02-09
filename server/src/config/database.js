const { Pool } = require('pg');
const logger = require('../utils/logger');

const dbUrl = process.env.DATABASE_URL || '';
const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
