const mammoth = require('mammoth');

// unpdf is ESM-only, so it is loaded with a dynamic import
async function pdfToText(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractText(file) {
  const name = file.originalname.toLowerCase();
  let text = '';

  if (name.endsWith('.pdf')) {
    text = await pdfToText(file.buffer);
  } else if (name.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    text = value;
  }

  // Normalize whitespace but keep line breaks (needed for bullet detection)
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { extractText };
