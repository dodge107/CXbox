import fs from 'node:fs/promises';

/**
 * Extract text from a CSV file.
 * Converts to markdown table format for readability.
 * @param {string} filePath - Absolute path to the CSV file
 * @returns {Promise<string>} Extracted plain text as markdown table
 */
export async function extractCsv(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');

  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const parts = [];

  for (const line of lines) {
    // Simple CSV parse (handles quoted fields with commas)
    const cells = parseCsvLine(line);
    parts.push('| ' + cells.map(c => c.trim()).join(' | ') + ' |');
  }

  // Insert markdown table separator after header
  const headerCells = parseCsvLine(lines[0]);
  const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
  parts.splice(1, 0, separator);

  return parts.join('\n');
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  cells.push(current);
  return cells;
}
