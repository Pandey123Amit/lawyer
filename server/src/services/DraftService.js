const OpenAI = require('openai');
const logger = require('../utils/logger');
const { getPromptForType } = require('../prompts/draftPrompts');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

class DraftService {
  /**
   * Generate a legal document draft from extracted metadata and transcript.
   * Two-step process: metadata enrichment → draft generation.
   */
  async generateDraft(transcript, metadata, documentType, options = {}) {
    const startTime = Date.now();
    const outputLanguage = options.outputLanguage || 'english';

    logger.info('Starting draft generation', { documentType, outputLanguage });

    try {
      const systemPrompt = getPromptForType(documentType);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate a formal legal document based on the following information.

TRANSCRIPT (original dictation):
${transcript}

EXTRACTED METADATA:
${JSON.stringify(metadata, null, 2)}

OUTPUT LANGUAGE: ${outputLanguage}

Generate the complete, court-ready document. Use proper legal formatting, numbered paragraphs, and formal language. Include all standard sections for this document type.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const draftText = response.choices[0].message.content;
      const latencyMs = Date.now() - startTime;

      logger.info('Draft generation completed', {
        latencyMs,
        tokensUsed: response.usage.total_tokens,
        outputLength: draftText.length,
      });

      return {
        draft: draftText,
        documentType,
        tokensUsed: response.usage.total_tokens,
        latencyMs,
      };
    } catch (err) {
      logger.error('Draft generation failed', { error: err.message, documentType });
      throw new Error(`Draft generation failed: ${err.message}`);
    }
  }

  /**
   * Refine an existing draft based on lawyer's edits/instructions.
   */
  async refineDraft(currentDraft, instructions) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a legal document editor for Indian courts. Modify the given document based on the lawyer's instructions. Maintain formal legal language and court-ready formatting. Return only the modified document.`,
          },
          {
            role: 'user',
            content: `CURRENT DOCUMENT:\n${currentDraft}\n\nINSTRUCTIONS:\n${instructions}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      });

      return {
        draft: response.choices[0].message.content,
        tokensUsed: response.usage.total_tokens,
      };
    } catch (err) {
      logger.error('Draft refinement failed', { error: err.message });
      throw new Error(`Draft refinement failed: ${err.message}`);
    }
  }
}

module.exports = new DraftService();
