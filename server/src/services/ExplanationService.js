const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const { DISCLAIMER_EN, DISCLAIMER_HI } = require('../utils/disclaimer');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

class ExplanationService {
  /**
   * Extract text from uploaded document (PDF or image).
   */
  async extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    logger.info('Extracting text', { filePath, ext });

    if (ext === '.pdf') {
      return this._extractFromPdf(filePath);
    } else if (['.png', '.jpg', '.jpeg', '.tiff'].includes(ext)) {
      return this._extractFromImage(filePath);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  async _extractFromPdf(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    if (data.text && data.text.trim().length > 50) {
      return { text: data.text, method: 'pdf-parse', pages: data.numpages };
    }

    // If PDF has very little text, it's likely scanned — try OCR
    logger.info('PDF text extraction yielded minimal text, attempting OCR');
    return this._extractFromImage(filePath);
  }

  async _extractFromImage(filePath) {
    const startTime = Date.now();

    const { data } = await Tesseract.recognize(filePath, 'eng+hin', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug('OCR progress', { progress: Math.round(m.progress * 100) });
        }
      },
    });

    const latencyMs = Date.now() - startTime;
    logger.info('OCR completed', { latencyMs, confidence: data.confidence, textLength: data.text.length });

    return {
      text: data.text,
      method: 'tesseract-ocr',
      confidence: data.confidence,
      latencyMs,
    };
  }

  /**
   * Generate a structured explanation of a legal document.
   * Output has 6 sections as specified.
   */
  async explain(documentText, options = {}) {
    const outputLanguage = options.outputLanguage || 'english';
    const startTime = Date.now();

    logger.info('Starting document explanation', { textLength: documentText.length, outputLanguage });

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a legal document analyst specializing in Indian law. Your job is to read legal/court documents and explain them in simple, clear ${outputLanguage} that a common person or a junior lawyer in a small Indian town can understand.

You MUST structure your response in exactly these 6 sections using the exact headings below:

## 1. WHAT THIS DOCUMENT IS ABOUT
Explain in 2-3 simple sentences what this document is — what type of document it is (court order, petition, notice, FIR, etc.), which court/authority issued it, between whom, and the case number if available.

## 2. IMPORTANT POINTS
List the key substantive points from the document as numbered bullet points. Cover the main arguments, findings, or claims. Use simple language.

## 3. DIRECTIONS / ORDERS
List any specific orders, directions, or rulings given by the court or authority. If it's not a court order, list any demands, requests, or required actions stated in the document.

## 4. DEADLINES AND DATES
List ALL dates mentioned in the document with their significance:
- Filing dates
- Hearing dates
- Compliance deadlines
- Limitation periods
If no dates are found, explicitly state "No specific dates or deadlines mentioned."

## 5. NEXT PROCEDURAL STEPS
Based on this document, advise what steps need to be taken next:
- What filings or responses are needed?
- By when must action be taken?
- Which court/office to approach?
- Any documents to prepare?
Be specific and practical.

## 6. DISCLAIMER
This explanation is AI-generated and is meant to assist in understanding the document. It does not constitute legal advice. Always consult a qualified advocate before taking any legal action based on this explanation.

IMPORTANT: Be accurate. Do not fabricate information not present in the document. If something is unclear, say so. Use the exact section headings above.`,
          },
          {
            role: 'user',
            content: `Please analyze and explain the following legal document:\n\n${documentText}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });

      const explanation = response.choices[0].message.content;
      const latencyMs = Date.now() - startTime;

      logger.info('Explanation generated', {
        latencyMs,
        tokensUsed: response.usage.total_tokens,
        outputLength: explanation.length,
      });

      return {
        explanation,
        tokensUsed: response.usage.total_tokens,
        latencyMs,
        sections: this._parseSections(explanation),
      };
    } catch (err) {
      logger.error('Explanation generation failed', { error: err.message });
      throw new Error(`Explanation failed: ${err.message}`);
    }
  }

  /**
   * Parse the structured explanation into individual sections.
   */
  _parseSections(text) {
    const sectionPatterns = [
      { key: 'about', pattern: /## 1\. WHAT THIS DOCUMENT IS ABOUT\s*\n([\s\S]*?)(?=## 2\.|$)/ },
      { key: 'important_points', pattern: /## 2\. IMPORTANT POINTS\s*\n([\s\S]*?)(?=## 3\.|$)/ },
      { key: 'directions', pattern: /## 3\. DIRECTIONS \/ ORDERS\s*\n([\s\S]*?)(?=## 4\.|$)/ },
      { key: 'deadlines', pattern: /## 4\. DEADLINES AND DATES\s*\n([\s\S]*?)(?=## 5\.|$)/ },
      { key: 'next_steps', pattern: /## 5\. NEXT PROCEDURAL STEPS\s*\n([\s\S]*?)(?=## 6\.|$)/ },
      { key: 'disclaimer', pattern: /## 6\. DISCLAIMER\s*\n([\s\S]*?)$/ },
    ];

    const sections = {};
    for (const { key, pattern } of sectionPatterns) {
      const match = text.match(pattern);
      sections[key] = match ? match[1].trim() : '';
    }

    return sections;
  }
}

module.exports = new ExplanationService();
