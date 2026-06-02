import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF file.
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractPdf(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  let text = data.text;

  // Clean up excessive whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text || text.length === 0) {
    throw new Error('PDF appears to contain no extractable text (may be image-only/scanned)');
  }

  return text;
}
