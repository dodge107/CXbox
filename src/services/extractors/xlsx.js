import fs from 'node:fs/promises';
import * as XLSX from 'xlsx';

/**
 * Extract text from an XLSX file.
 * Converts each sheet to a readable table-like text format.
 * @param {string} filePath - Absolute path to the XLSX file
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractXlsx(filePath) {
  const data = await fs.readFile(filePath);
  const workbook = XLSX.read(data);
  const parts = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (json.length === 0) continue;

    parts.push(`## Sheet: ${sheetName}`);
    parts.push('');

    // Find max columns for alignment
    const maxCols = Math.max(...json.map(row => row.length));

    // Build header row
    const header = json[0] || [];
    parts.push('| ' + header.map(cell => String(cell).trim()).join(' | ') + ' |');
    parts.push('| ' + header.map(() => '---').join(' | ') + ' |');

    // Build data rows
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      const cells = [];
      for (let c = 0; c < maxCols; c++) {
        cells.push(String(row[c] ?? '').trim());
      }
      parts.push('| ' + cells.join(' | ') + ' |');
    }

    parts.push('');
  }

  const text = parts.join('\n');

  if (!text || text.trim().length === 0) {
    throw new Error('XLSX appears to contain no data');
  }

  return text;
}
