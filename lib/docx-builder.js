/**
 * Converts markdown to DOCX using the docx npm package.
 * Parses markdown line-by-line and maps to docx objects.
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType
} = require('docx');

function parseInlineFormatting(text) {
  const runs = [];
  // Match bold+italic, bold, italic, links, and plain text
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)|([^*[\]]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // Bold + italic
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      // Bold
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4]) {
      // Italic
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5] && match[6]) {
      // Link — render as "text (url)"
      runs.push(new TextRun({ text: match[5] }));
      runs.push(new TextRun({ text: ` (${match[6]})`, italics: true, size: 20 }));
    } else if (match[7]) {
      // Plain text
      runs.push(new TextRun({ text: match[7] }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function markdownToDocx(markdown, title = 'Document') {
  const lines = markdown.split('\n');
  const children = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      children.push(new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' }
        },
        spacing: { before: 100, after: 100 }
      }));
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingLevels = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4
      };
      children.push(new Paragraph({
        heading: headingLevels[level] || HeadingLevel.HEADING_4,
        children: parseInlineFormatting(text),
        spacing: { before: 200, after: 100 }
      }));
      continue;
    }

    // Bullet points
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const level = Math.min(Math.floor(indent / 2), 2);
      children.push(new Paragraph({
        bullet: { level },
        children: parseInlineFormatting(bulletMatch[2]),
        spacing: { before: 40, after: 40 }
      }));
      continue;
    }

    // Regular paragraph
    children.push(new Paragraph({
      children: parseInlineFormatting(line),
      spacing: { before: 60, after: 60 }
    }));
  }

  const doc = new Document({
    title,
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children
    }]
  });

  return doc;
}

async function buildDocx(markdown, title = 'Document') {
  const doc = markdownToDocx(markdown, title);
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx, markdownToDocx };
