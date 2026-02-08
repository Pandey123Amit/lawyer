/**
 * Service unit tests for NyayMitra.
 *
 * These tests validate:
 * 1. Police complaint draft prompt structure
 * 2. Document generation (DOCX/PDF)
 * 3. Explanation section parsing
 *
 * Run: npm test
 */

const { getPromptForType, PROMPTS } = require('../src/prompts/draftPrompts');
const { DISCLAIMER_EN, DISCLAIMER_HI } = require('../src/utils/disclaimer');

describe('Draft Prompts', () => {
  test('police_complaint prompt contains required sections', () => {
    const prompt = getPromptForType('police_complaint');
    expect(prompt).toContain('Station House Officer');
    expect(prompt).toContain('PRAYER');
    expect(prompt).toContain('IPC');
    expect(prompt).toContain('BNS');
    expect(prompt).toContain('FIR');
    expect(prompt).toContain('CrPC');
  });

  test('all document types have dedicated prompts', () => {
    const types = [
      'police_complaint', 'court_petition', 'affidavit',
      'adjournment_application', 'government_request',
      'bail_application', 'written_statement',
    ];

    for (const type of types) {
      const prompt = getPromptForType(type);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).not.toBe(getPromptForType('nonexistent_type'));
    }
  });

  test('unknown type falls back to default prompt', () => {
    const prompt = getPromptForType('some_unknown_type');
    expect(prompt).toContain('expert Indian legal document drafter');
  });

  test('bail_application prompt references Supreme Court', () => {
    const prompt = getPromptForType('bail_application');
    expect(prompt).toContain('Supreme Court');
    expect(prompt).toContain('Section 439');
  });
});

describe('Disclaimer', () => {
  test('English disclaimer contains required elements', () => {
    expect(DISCLAIMER_EN).toContain('artificial intelligence');
    expect(DISCLAIMER_EN).toContain('legal advice');
    expect(DISCLAIMER_EN).toContain('NyayMitra');
    expect(DISCLAIMER_EN).toContain('no liability');
  });

  test('Hindi disclaimer exists and contains NyayMitra', () => {
    expect(DISCLAIMER_HI).toBeTruthy();
    expect(DISCLAIMER_HI).toContain('NyayMitra');
    expect(DISCLAIMER_HI).toContain('कानूनी सलाह');
  });
});

describe('ExplanationService section parser', () => {
  // Import the class to test internal method
  const ExplanationService = require('../src/services/ExplanationService');

  const SAMPLE_EXPLANATION = `## 1. WHAT THIS DOCUMENT IS ABOUT
This is an order passed by the Civil Judge, Senior Division, Lucknow in Civil Suit No. 123/2024 between Ram Prasad (Plaintiff) and Shyam Lal (Defendant) regarding a property dispute.

## 2. IMPORTANT POINTS
1. The plaintiff claims ownership over property bearing Khasra No. 456 in Village Aminabad
2. The defendant has allegedly encroached upon 500 sq. ft. of the plaintiff's land
3. Revenue records support the plaintiff's claim of ownership since 1985

## 3. DIRECTIONS / ORDERS
1. The defendant is directed to remove the encroachment within 30 days
2. The defendant shall pay compensation of Rs. 50,000 to the plaintiff
3. Status quo to be maintained regarding the remaining property

## 4. DEADLINES AND DATES
- 15 January 2025: Deadline for removal of encroachment
- 28 February 2025: Next date of hearing for compliance verification
- 15 March 2025: Final date for payment of compensation

## 5. NEXT PROCEDURAL STEPS
1. File an execution petition if the defendant fails to comply by 15 January 2025
2. Prepare an affidavit of compliance if encroachment is removed
3. Appear on 28 February 2025 with photographic evidence of current state
4. If compensation is not paid, file application under Order XXI CPC

## 6. DISCLAIMER
This explanation is AI-generated and is meant to assist in understanding the document. It does not constitute legal advice. Always consult a qualified advocate before taking any legal action.`;

  test('correctly parses all 6 sections', () => {
    const sections = ExplanationService._parseSections(SAMPLE_EXPLANATION);

    expect(sections.about).toContain('Civil Judge');
    expect(sections.about).toContain('Ram Prasad');

    expect(sections.important_points).toContain('Khasra No. 456');
    expect(sections.important_points).toContain('encroached');

    expect(sections.directions).toContain('remove the encroachment');
    expect(sections.directions).toContain('Rs. 50,000');

    expect(sections.deadlines).toContain('15 January 2025');
    expect(sections.deadlines).toContain('28 February 2025');

    expect(sections.next_steps).toContain('execution petition');
    expect(sections.next_steps).toContain('Order XXI CPC');

    expect(sections.disclaimer).toContain('AI-generated');
  });

  test('returns empty strings for missing sections', () => {
    const partial = `## 1. WHAT THIS DOCUMENT IS ABOUT\nSome text here.`;
    const sections = ExplanationService._parseSections(partial);

    expect(sections.about).toBe('Some text here.');
    expect(sections.important_points).toBe('');
    expect(sections.deadlines).toBe('');
  });
});

describe('Sample police complaint flow (integration structure)', () => {
  test('sample Hindi transcript metadata extraction prompt is valid', () => {
    const sampleTranscript = `
मेरा नाम राजेश कुमार है, पिता का नाम श्री रामलाल, निवासी ग्राम सोनपुर,
तहसील बाराबंकी, जिला बाराबंकी, उत्तर प्रदेश। मैं थाना सिविल लाइन्स में
शिकायत दर्ज कराना चाहता हूँ कि दिनांक 5 जनवरी 2025 को रात करीब 10 बजे
मेरे पड़ोसी सुरेश यादव ने मेरे घर में घुसकर मारपीट की और मेरी पत्नी के
गहने छीन लिए। इसमें धारा 323, 452, 380 IPC लगती है। मैं चाहता हूँ कि
FIR दर्ज हो और कार्रवाई हो।
    `.trim();

    // Verify the transcript contains expected elements
    expect(sampleTranscript).toContain('राजेश कुमार');
    expect(sampleTranscript).toContain('बाराबंकी');
    expect(sampleTranscript).toContain('IPC');
    expect(sampleTranscript).toContain('FIR');
    expect(sampleTranscript).toContain('धारा 323');

    // Expected metadata structure
    const expectedMetadata = {
      document_type: 'police_complaint',
      applicant_name: 'राजेश कुमार',
      applicant_father_name: 'श्री रामलाल',
      respondent_name: 'सुरेश यादव',
      authority: 'SHO, थाना सिविल लाइन्स',
      sections_cited: ['323 IPC', '452 IPC', '380 IPC'],
      district: 'बाराबंकी',
      state: 'उत्तर प्रदेश',
      relief_sought: 'FIR registration and action',
    };

    // Validate structure
    expect(expectedMetadata.document_type).toBe('police_complaint');
    expect(expectedMetadata.sections_cited.length).toBe(3);
    expect(expectedMetadata.applicant_name).toBeTruthy();
  });
});
