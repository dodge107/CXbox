import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/* ------------------------------------------------------------------ */
/*  Pandoc-supported input formats → markdown                          */
/* ------------------------------------------------------------------ */

/**
 * Map of file extensions to Pandoc input format names.
 * Pandoc auto-detects most formats, but some need explicit hints.
 */
const FORMAT_MAP = {
  docx: 'docx',
  doc: 'doc',
  odt: 'odt',
  rtf: 'rtf',
  html: 'html',
  htm: 'html',
  epub: 'epub',
  txt: 'markdown',
  md: 'markdown',
  markdown: 'markdown',
  latex: 'latex',
  tex: 'latex',
  org: 'org',
  mediawiki: 'mediawiki',
  tikiwiki: 'tikiwiki',
  opml: 'opml',
  jats: 'jats',
  docbook: 'docbook',
  textile: 'textile',
  twiki: 'twiki',
  vimwiki: 'vimwiki',
  man: 'man',
  muse: 'muse',
  native: 'native',
  csv: 'csv',
  tsv: 'tsv',
  pptx: 'pptx',
  xlsx: 'xlsx',
};

/**
 * Extract text from a file using Pandoc, converting to markdown.
 * @param {string} filePath - Absolute path to the file
 * @param {string} ext - File extension (without dot)
 * @returns {Promise<string>} Extracted markdown text
 */
export async function extractPandoc(filePath, ext) {
  const format = FORMAT_MAP[ext];
  if (!format) {
    throw new Error(`Pandoc does not support .${ext} files`);
  }

  const args = [
    filePath,
    '-f', format,
    '-t', 'markdown',
    '--wrap=none',
    '--extract-media=',
    '--standalone',
  ];

  try {
    const { stdout, stderr } = await exec('pandoc', args, {
      timeout: 30_000, // 30s timeout for large documents
      maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
    });

    if (stderr) {
      console.warn(`pandoc warnings for ${filePath}: ${stderr}`);
    }

    let text = stdout.trim();

    // Remove pandoc's YAML frontmatter if present (we add our own)
    text = text.replace(/^---\n[\s\S]*?\n---\n?/, '');

    // Clean up excessive blank lines
    text = text.replace(/\n{4,}/g, '\n\n\n').trim();

    if (!text || text.length === 0) {
      throw new Error(`Pandoc produced no output for .${ext} file`);
    }

    return text;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('Pandoc is not installed. Install it or use a dedicated extractor.');
    }
    if (err.killed) {
      throw new Error(`Pandoc timed out after 30s processing ${filePath}`);
    }
    throw new Error(`Pandoc failed: ${err.message}`);
  }
}

/**
 * Get the list of file extensions Pandoc can handle.
 */
export function getPandocExtensions() {
  return Object.keys(FORMAT_MAP);
}

/**
 * Check if Pandoc supports a given extension.
 */
export function isPandocSupported(ext) {
  return ext.replace('.', '').toLowerCase() in FORMAT_MAP;
}
