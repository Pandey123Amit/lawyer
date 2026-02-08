require('dotenv').config();
const { pool } = require('./database');
const logger = require('../utils/logger');

const migration = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'lawyer',
    bar_council_id VARCHAR(100),
    usage_count INT DEFAULT 0,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('create', 'understand')),
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    document_type VARCHAR(100),
    title VARCHAR(500),
    input_file_path VARCHAR(500),
    output_file_path VARCHAR(500),
    transcript TEXT,
    ai_output TEXT,
    metadata JSONB DEFAULT '{}',
    language VARCHAR(20) DEFAULT 'hi',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '72 hours')
  );

  CREATE TABLE IF NOT EXISTS ai_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prompt_type VARCHAR(50),
    prompt_text TEXT,
    response_text TEXT,
    model VARCHAR(100),
    tokens_used INT,
    latency_ms INT,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_text TEXT,
    edited_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);
  CREATE INDEX IF NOT EXISTS idx_ai_logs_document_id ON ai_logs(document_id);
`;

async function runMigration() {
  try {
    await pool.query(migration);
    logger.info('Database migration completed successfully');
  } catch (err) {
    logger.error('Migration failed', err);
    throw err;
  } finally {
    await pool.end();
  }
}

runMigration();
