const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { audioUpload } = require('../middleware/upload');
const VoiceService = require('../services/VoiceService');
const DraftService = require('../services/DraftService');
const DocumentService = require('../services/DocumentService');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/create/transcribe — Upload audio, get transcript + metadata
router.post('/transcribe', authenticate, audioUpload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const language = req.body.language || 'hi';

    // Step 1: Transcribe
    const transcription = await VoiceService.transcribe(filePath, language);

    // Step 2: Extract metadata
    const { metadata, tokensUsed } = await VoiceService.extractMetadata(transcription.text);

    // Save to DB
    const result = await db.query(
      `INSERT INTO documents (user_id, mode, document_type, title, input_file_path, transcript, metadata, language)
       VALUES ($1, 'create', $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        req.user.id,
        metadata.document_type || 'other',
        metadata.subject || 'Untitled',
        filePath,
        transcription.text,
        JSON.stringify(metadata),
        language,
      ]
    );

    // Log AI usage
    await db.query(
      `INSERT INTO ai_logs (document_id, user_id, prompt_type, model, tokens_used, latency_ms)
       VALUES ($1, $2, 'metadata_extraction', 'gpt-4o', $3, $4)`,
      [result.rows[0].id, req.user.id, tokensUsed, transcription.latencyMs]
    );

    res.json({
      documentId: result.rows[0].id,
      transcript: transcription.text,
      metadata,
      audioDuration: transcription.duration,
    });
  } catch (err) {
    logger.error('Transcription endpoint failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/create/draft — Generate legal document draft
router.post('/draft', authenticate, async (req, res) => {
  try {
    const { documentId, transcript, metadata, documentType, outputLanguage } = req.body;

    if (!transcript || !documentType) {
      return res.status(400).json({ error: 'transcript and documentType are required' });
    }

    const result = await DraftService.generateDraft(
      transcript,
      metadata || {},
      documentType,
      { outputLanguage: outputLanguage || 'english' }
    );

    // Update document record
    if (documentId) {
      await db.query(
        `UPDATE documents SET ai_output = $1, document_type = $2, status = 'completed', updated_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [result.draft, documentType, documentId, req.user.id]
      );

      await db.query(
        `INSERT INTO ai_logs (document_id, user_id, prompt_type, model, tokens_used, latency_ms)
         VALUES ($1, $2, 'draft_generation', 'gpt-4o', $3, $4)`,
        [documentId, req.user.id, result.tokensUsed, result.latencyMs]
      );
    }

    // Increment usage
    await db.query(
      'UPDATE users SET usage_count = usage_count + 1 WHERE id = $1',
      [req.user.id]
    );

    res.json({
      documentId,
      draft: result.draft,
      documentType: result.documentType,
    });
  } catch (err) {
    logger.error('Draft generation endpoint failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/create/refine — Refine an existing draft
router.post('/refine', authenticate, async (req, res) => {
  try {
    const { documentId, currentDraft, instructions } = req.body;

    if (!currentDraft || !instructions) {
      return res.status(400).json({ error: 'currentDraft and instructions are required' });
    }

    const result = await DraftService.refineDraft(currentDraft, instructions);

    if (documentId) {
      // Save edit history
      await db.query(
        `INSERT INTO edits (document_id, user_id, original_text, edited_text)
         VALUES ($1, $2, $3, $4)`,
        [documentId, req.user.id, currentDraft, result.draft]
      );

      await db.query(
        `UPDATE documents SET ai_output = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [result.draft, documentId, req.user.id]
      );
    }

    res.json({ draft: result.draft });
  } catch (err) {
    logger.error('Refinement endpoint failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/create/export — Generate DOCX or PDF from draft
router.post('/export', authenticate, async (req, res) => {
  try {
    const { documentId, draft, format, metadata } = req.body;

    if (!draft) {
      return res.status(400).json({ error: 'draft text is required' });
    }

    let fileResult;
    if (format === 'pdf') {
      fileResult = await DocumentService.generatePdf(draft, metadata || {});
    } else {
      fileResult = await DocumentService.generateDocx(draft, metadata || {});
    }

    if (documentId) {
      await db.query(
        `UPDATE documents SET output_file_path = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [fileResult.filePath, documentId, req.user.id]
      );
    }

    res.download(fileResult.filePath, fileResult.fileName, (err) => {
      if (err) logger.error('File download failed', { error: err.message });
    });
  } catch (err) {
    logger.error('Export endpoint failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/create/from-text — Skip voice, directly provide text for draft
router.post('/from-text', authenticate, async (req, res) => {
  try {
    const { text, documentType, language, outputLanguage } = req.body;

    if (!text || !documentType) {
      return res.status(400).json({ error: 'text and documentType are required' });
    }

    // Extract metadata
    const { metadata } = await VoiceService.extractMetadata(text);
    metadata.document_type = documentType;

    // Generate draft
    const result = await DraftService.generateDraft(
      text, metadata, documentType,
      { outputLanguage: outputLanguage || 'english' }
    );

    // Save to DB
    const docResult = await db.query(
      `INSERT INTO documents (user_id, mode, document_type, title, transcript, ai_output, metadata, language, status)
       VALUES ($1, 'create', $2, $3, $4, $5, $6, $7, 'completed') RETURNING id`,
      [req.user.id, documentType, metadata.subject || 'Untitled', text, result.draft, JSON.stringify(metadata), language || 'hi']
    );

    await db.query('UPDATE users SET usage_count = usage_count + 1 WHERE id = $1', [req.user.id]);

    res.json({
      documentId: docResult.rows[0].id,
      draft: result.draft,
      metadata,
    });
  } catch (err) {
    logger.error('Text-to-draft endpoint failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
