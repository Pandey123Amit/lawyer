const express = require('express');
const { authenticate } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const ExplanationService = require('../services/ExplanationService');
const DocumentService = require('../services/DocumentService');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/understand/upload — Upload document and get explanation
router.post('/upload', authenticate, documentUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required (PDF or image)' });
    }

    const filePath = req.file.path;
    const outputLanguage = req.body.language || 'english';

    // Step 1: Extract text
    const extraction = await ExplanationService.extractText(filePath);

    if (!extraction.text || extraction.text.trim().length < 20) {
      return res.status(422).json({
        error: 'Could not extract sufficient text from the document. Please upload a clearer copy.',
      });
    }

    // Step 2: Generate explanation
    const explanation = await ExplanationService.explain(extraction.text, {
      outputLanguage,
    });

    // Save to DB
    const result = await db.query(
      `INSERT INTO documents (user_id, mode, document_type, title, input_file_path, transcript, ai_output, metadata, language, status)
       VALUES ($1, 'understand', 'explanation', 'Document Explanation', $2, $3, $4, $5, $6, 'completed')
       RETURNING id`,
      [
        req.user.id,
        filePath,
        extraction.text,
        explanation.explanation,
        JSON.stringify({
          extractionMethod: extraction.method,
          ocrConfidence: extraction.confidence,
          pages: extraction.pages,
        }),
        outputLanguage === 'hindi' ? 'hi' : 'en',
      ]
    );

    // Log AI usage
    await db.query(
      `INSERT INTO ai_logs (document_id, user_id, prompt_type, model, tokens_used, latency_ms)
       VALUES ($1, $2, 'document_explanation', 'gpt-4o', $3, $4)`,
      [result.rows[0].id, req.user.id, explanation.tokensUsed, explanation.latencyMs]
    );

    await db.query('UPDATE users SET usage_count = usage_count + 1 WHERE id = $1', [req.user.id]);

    res.json({
      documentId: result.rows[0].id,
      extractedText: extraction.text.substring(0, 500) + (extraction.text.length > 500 ? '...' : ''),
      extractionMethod: extraction.method,
      explanation: explanation.explanation,
      sections: explanation.sections,
    });
  } catch (err) {
    logger.error('Document upload/explanation failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/understand/explain-text — Explain pasted text directly
router.post('/explain-text', authenticate, async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Please provide at least 20 characters of document text' });
    }

    const explanation = await ExplanationService.explain(text, {
      outputLanguage: language || 'english',
    });

    const result = await db.query(
      `INSERT INTO documents (user_id, mode, document_type, title, transcript, ai_output, language, status)
       VALUES ($1, 'understand', 'explanation', 'Text Explanation', $2, $3, $4, 'completed')
       RETURNING id`,
      [req.user.id, text, explanation.explanation, language === 'hindi' ? 'hi' : 'en']
    );

    await db.query('UPDATE users SET usage_count = usage_count + 1 WHERE id = $1', [req.user.id]);

    res.json({
      documentId: result.rows[0].id,
      explanation: explanation.explanation,
      sections: explanation.sections,
    });
  } catch (err) {
    logger.error('Text explanation failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/understand/export — Export explanation as PDF
router.post('/export', authenticate, async (req, res) => {
  try {
    const { explanation, format } = req.body;

    if (!explanation) {
      return res.status(400).json({ error: 'explanation text is required' });
    }

    let fileResult;
    if (format === 'docx') {
      fileResult = await DocumentService.generateDocx(explanation, { title: 'Document Explanation - NyayMitra' });
    } else {
      fileResult = await DocumentService.generatePdf(explanation, { title: 'Document Explanation - NyayMitra' });
    }

    res.download(fileResult.filePath, fileResult.fileName);
  } catch (err) {
    logger.error('Explanation export failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
