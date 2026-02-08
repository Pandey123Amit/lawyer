const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/documents — List user's documents
router.get('/', authenticate, async (req, res) => {
  try {
    const { mode, status, limit = 20, offset = 0 } = req.query;

    let query = `SELECT id, mode, document_type, title, status, language, created_at, updated_at
                 FROM documents WHERE user_id = $1`;
    const params = [req.user.id];
    let paramIdx = 2;

    if (mode) {
      query += ` AND mode = $${paramIdx++}`;
      params.push(mode);
    }
    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    res.json({ documents: result.rows, total: result.rows.length });
  } catch (err) {
    logger.error('List documents failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// GET /api/documents/:id — Get single document with full content
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, mode, document_type, title, status, transcript, ai_output, metadata, language, created_at
       FROM documents WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: result.rows[0] });
  } catch (err) {
    logger.error('Get document failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// DELETE /api/documents/:id — Delete document and associated files
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    logger.error('Delete document failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
