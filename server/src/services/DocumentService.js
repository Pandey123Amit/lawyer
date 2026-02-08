const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TabStopPosition, TabStopType,
  Header, Footer, PageNumber, NumberFormat,
} = require('docx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DISCLAIMER_EN } = require('../utils/disclaimer');
const logger = require('../utils/logger');

const OUTPUT_DIR = path.join(__dirname, '../../uploads');

class DocumentService {
  /**
   * Generate a court-ready DOCX file from draft text.
   * Format: Times New Roman, 12pt, 1-inch margins, A4, double-spaced.
   */
  async generateDocx(draftText, metadata = {}) {
    const fileName = `${uuidv4()}.docx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    const paragraphs = this._parseDraftToParagraphs(draftText);

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Times New Roman', size: 24 }, // 12pt = 24 half-points
            paragraph: { spacing: { line: 360 } }, // 1.5 line spacing
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch = 1440 twips
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                text: metadata.title || '',
                font: 'Times New Roman',
                size: 18,
                italics: true,
                color: '888888',
              })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', font: 'Times New Roman', size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 18 }),
              ],
            })],
          }),
        },
        children: [
          ...paragraphs,
          // Disclaimer section
          new Paragraph({ spacing: { before: 600 } }),
          new Paragraph({
            children: [new TextRun({
              text: '─'.repeat(50),
              font: 'Times New Roman',
              size: 18,
              color: '999999',
            })],
          }),
          new Paragraph({
            children: [new TextRun({
              text: DISCLAIMER_EN,
              font: 'Times New Roman',
              size: 16,
              italics: true,
              color: '666666',
            })],
            spacing: { before: 200 },
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    logger.info('DOCX generated', { filePath, size: buffer.length });

    return { filePath, fileName, size: buffer.length };
  }

  /**
   * Generate a PDF from draft text.
   */
  async generatePdf(draftText, metadata = {}) {
    const fileName = `${uuidv4()}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 72, right: 72 }, // 1 inch
        info: {
          Title: metadata.title || 'Legal Document',
          Author: 'NyayMitra',
          Subject: metadata.document_type || 'Legal Document',
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Register and use Times New Roman (fallback to built-in serif)
      doc.font('Times-Roman').fontSize(12);

      // Title
      if (metadata.title) {
        doc.fontSize(14).text(metadata.title, { align: 'center', underline: true });
        doc.moveDown(2);
        doc.fontSize(12);
      }

      // Body
      const lines = draftText.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.5);
          continue;
        }
        // Detect headings (all-caps or lines ending with colon)
        if (line === line.toUpperCase() && line.trim().length > 3) {
          doc.font('Times-Bold').text(line.trim(), { align: 'center' });
          doc.font('Times-Roman');
        } else {
          doc.text(line.trim(), { align: 'justify', lineGap: 4 });
        }
      }

      // Disclaimer
      doc.moveDown(3);
      doc.fontSize(8)
        .fillColor('#666666')
        .font('Times-Italic')
        .text('─'.repeat(80), { align: 'center' })
        .moveDown(0.5)
        .text(DISCLAIMER_EN, { align: 'justify' });

      doc.end();

      stream.on('finish', () => {
        const stats = fs.statSync(filePath);
        logger.info('PDF generated', { filePath, size: stats.size });
        resolve({ filePath, fileName, size: stats.size });
      });
      stream.on('error', reject);
    });
  }

  /**
   * Parse draft text into DOCX Paragraph objects.
   */
  _parseDraftToParagraphs(text) {
    const lines = text.split('\n');
    const paragraphs = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        paragraphs.push(new Paragraph({ spacing: { before: 120 } }));
        continue;
      }

      // ALL-CAPS lines → centered bold headings
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)) {
        paragraphs.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({
            text: trimmed,
            bold: true,
            font: 'Times New Roman',
            size: 26,
          })],
        }));
        continue;
      }

      // Lines starting with numbers → numbered paragraphs
      const numberedMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numberedMatch) {
        paragraphs.push(new Paragraph({
          spacing: { before: 120, after: 60 },
          indent: { left: 720 , hanging: 360 }, // 0.5 inch indent
          children: [new TextRun({
            text: `${numberedMatch[1]}. ${numberedMatch[2]}`,
            font: 'Times New Roman',
            size: 24,
          })],
        }));
        continue;
      }

      // Regular paragraph
      paragraphs.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({
          text: trimmed,
          font: 'Times New Roman',
          size: 24,
        })],
      }));
    }

    return paragraphs;
  }
}

module.exports = new DocumentService();
