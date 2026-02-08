const fs = require('fs');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

class VoiceService {
  /**
   * Transcribe audio file to text using OpenAI Whisper.
   * Optimized for Hindi and Indian English legal dictation.
   */
  async transcribe(filePath, language = 'hi') {
    const startTime = Date.now();
    logger.info('Starting transcription', { filePath, language });

    try {
      const audioStream = fs.createReadStream(filePath);
      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioStream,
        language,
        prompt: 'Legal dictation in Hindi. May include terms like: ' +
          'FIR, धारा, अदालत, न्यायालय, याचिका, प्रार्थना पत्र, ' +
          'शिकायत, अभियुक्त, वादी, प्रतिवादी, आदेश, निर्णय, ' +
          'तहसीलदार, कलेक्टर, पुलिस अधीक्षक, थाना, ' +
          'Section, IPC, CrPC, CPC, BNS, BNSS',
        response_format: 'verbose_json',
      });

      const latencyMs = Date.now() - startTime;
      logger.info('Transcription completed', { latencyMs, textLength: response.text.length });

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments,
        latencyMs,
      };
    } catch (err) {
      logger.error('Transcription failed', { error: err.message, filePath });
      throw new Error(`Transcription failed: ${err.message}`);
    }
  }

  /**
   * Extract structured metadata from transcribed text.
   * Identifies: applicant, authority, document type, dates, key facts.
   */
  async extractMetadata(transcript) {
    const startTime = Date.now();

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a legal metadata extraction assistant for Indian courts and government offices.
Extract structured information from the following Hindi/English legal dictation transcript.
Return a JSON object with these fields:
- document_type: one of ["police_complaint", "court_petition", "affidavit", "adjournment_application", "government_request", "bail_application", "written_statement", "other"]
- applicant_name: name of the person filing
- applicant_father_name: father's/husband's name if mentioned
- applicant_address: full address if mentioned
- respondent_name: opposing party or authority name
- authority: court/office/authority being addressed
- subject: brief subject line for the document
- key_facts: array of key factual points mentioned
- sections_cited: any legal sections mentioned (IPC, CrPC, BNS, etc.)
- dates_mentioned: any dates mentioned with context
- relief_sought: what the applicant wants
- district: district name if mentioned
- state: state name if mentioned

If a field is not found in the transcript, use null.
Return ONLY valid JSON, no markdown.`,
          },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const metadata = JSON.parse(response.choices[0].message.content);
      const latencyMs = Date.now() - startTime;

      logger.info('Metadata extraction completed', { latencyMs, documentType: metadata.document_type });

      return {
        metadata,
        tokensUsed: response.usage.total_tokens,
        latencyMs,
      };
    } catch (err) {
      logger.error('Metadata extraction failed', { error: err.message });
      throw new Error(`Metadata extraction failed: ${err.message}`);
    }
  }
}

module.exports = new VoiceService();
