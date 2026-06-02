import { extractPdf } from './pdf.js';
import { extractXlsx } from './xlsx.js';
import { extractCsv } from './csv.js';
import { extractPandoc, getPandocExtensions } from './pandoc.js';

/* ------------------------------------------------------------------ */
/*  Specialized extractors (better than Pandoc for these formats)      */
/* ------------------------------------------------------------------ */

const SPECIALIZED = {
  pdf: { fn: extractPdf, label: 'PDF (pdf-parse)' },
  xlsx: { fn: extractXlsx, label: 'XLSX (table extractor)' },
  xls: { fn: extractXlsx, label: 'XLS (table extractor)' },
  csv: { fn: extractCsv, label: 'CSV (table extractor)' },
};

/* ------------------------------------------------------------------ */
/*  Pandoc-supported formats (everything else)                         */
/* ------------------------------------------------------------------ */

const PANDOC_EXTS = getPandocExtensions();

/**
 * Get the list of all supported file extensions.
 */
export function getSupportedExtensions() {
  return [...new Set([...Object.keys(SPECIALIZED), ...PANDOC_EXTS])];
}

/**
 * Check if a file extension is supported.
 */
export function isSupported(ext) {
  const normalized = ext.replace('.', '').toLowerCase();
  return normalized in SPECIALIZED || PANDOC_EXTS.includes(normalized);
}

/**
 * Extract text from a file based on its extension.
 * Uses specialized extractors for PDF/XLSX/CSV, Pandoc for everything else.
 * @param {string} filePath - Absolute path to the file
 * @param {string} ext - File extension (without dot), e.g. 'pdf', 'docx'
 * @returns {Promise<{ text: string, extractor: string }>}
 */
export async function extractText(filePath, ext) {
  const normalized = ext.replace('.', '').toLowerCase();

  // Use specialized extractor if available
  if (normalized in SPECIALIZED) {
    const spec = SPECIALIZED[normalized];
    const text = await spec.fn(filePath);
    return { text, extractor: spec.label };
  }

  // Fall back to Pandoc
  if (PANDOC_EXTS.includes(normalized)) {
    const text = await extractPandoc(filePath, normalized);
    return { text, extractor: 'Pandoc' };
  }

  throw new Error(`Unsupported file type: .${normalized}. Supported: ${getSupportedExtensions().join(', ')}`);
}
