import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  customerPath,
  readJSON,
  writeJSON,
  readMarkdown,
  atomicWrite,
  fileExists,
  listFiles,
  acquireLock,
  releaseLock,
} from './fileStore.js';
import { extractText as runExtractor, isSupported, getSupportedExtensions } from './extractors/index.js';

/* ------------------------------------------------------------------ */
/*  Document metadata helpers                                          */
/* ------------------------------------------------------------------ */

/** Generate a short document ID */
function docId() {
  return randomUUID().slice(0, 8);
}

/** Get file extension (without dot) */
function ext(filename) {
  return path.extname(filename).replace('.', '').toLowerCase();
}

/** Human-readable file size */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Add a document entry to the index */
export async function addDocument(customerId, filename, fileSize) {
  const docs = await readDocumentIndex(customerId);
  const entry = {
    id: docId(),
    filename,
    ext: ext(filename),
    size: fileSize,
    sizeHuman: formatSize(fileSize),
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    extractedAt: null,
    processedAt: null,
    error: null,
  };
  docs.push(entry);
  await writeDocumentIndex(customerId, docs);
  return entry;
}

/** Get all documents for a customer */
export async function getDocuments(customerId) {
  return readDocumentIndex(customerId);
}

/** Get a single document by ID */
export async function getDocument(customerId, documentId) {
  const docs = await readDocumentIndex(customerId);
  const doc = docs.find(d => d.id === documentId);
  if (!doc) throw Object.assign(new Error('Document not found'), { code: 'NOT_FOUND' });
  return doc;
}

/** Delete a document by ID (removes from index + raw/extracted files) */
export async function deleteDocument(customerId, documentId) {
  const docs = await readDocumentIndex(customerId);
  const idx = docs.findIndex(d => d.id === documentId);
  if (idx === -1) throw Object.assign(new Error('Document not found'), { code: 'NOT_FOUND' });

  const doc = docs[idx];

  // Remove raw file
  const rawPath = customerPath(customerId, 'raw', doc.filename);
  try { await fs.unlink(rawPath); } catch { /* may not exist */ }

  // Remove extracted file
  const extractedPath = customerPath(customerId, 'extracted', doc.id + '.txt');
  try { await fs.unlink(extractedPath); } catch { /* may not exist */ }

  docs.splice(idx, 1);
  await writeDocumentIndex(customerId, docs);
  return { success: true };
}

/** Update document status */
export async function updateDocumentStatus(customerId, documentId, status, extra = {}) {
  const docs = await readDocumentIndex(customerId);
  const doc = docs.find(d => d.id === documentId);
  if (!doc) throw Object.assign(new Error('Document not found'), { code: 'NOT_FOUND' });

  doc.status = status;
  if (status === 'extracted') doc.extractedAt = new Date().toISOString();
  if (status === 'wiki_ready' || status === 'failed') doc.processedAt = new Date().toISOString();
  if (extra.error) doc.error = extra.error;

  await writeDocumentIndex(customerId, docs);
  return doc;
}

/** Read the raw document index */
async function readDocumentIndex(customerId) {
  const indexPath = customerPath(customerId, 'documents.json');
  if (!(await fileExists(indexPath))) return [];
  return readJSON(indexPath);
}

/** Write the document index */
async function writeDocumentIndex(customerId, docs) {
  await writeJSON(customerPath(customerId, 'documents.json'), docs);
}

/* ------------------------------------------------------------------ */
/*  Text extraction (uses pluggable extractors)                        */
/* ------------------------------------------------------------------ */

/**
 * Extract text from a raw document file using the appropriate extractor.
 */
export async function extractText(customerId, documentId) {
  const doc = await getDocument(customerId, documentId);
  const rawPath = customerPath(customerId, 'raw', doc.filename);
  const outPath = customerPath(customerId, 'extracted', documentId + '.txt');

  if (!(await fileExists(rawPath))) {
    throw new Error('Raw file not found');
  }

  if (!isSupported(doc.ext)) {
    throw new Error(
      `Unsupported file type: .${doc.ext}. Supported: ${getSupportedExtensions().join(', ')}`
    );
  }

  const { text, extractor } = await runExtractor(rawPath, doc.ext);

  // Build output with metadata header
  const output = [
    `<!-- Extracted from: ${doc.filename} -->`,
    `<!-- Extractor: ${extractor} -->`,
    `<!-- Extracted at: ${new Date().toISOString()} -->`,
    `<!-- Original size: ${doc.sizeHuman} -->`,
    '',
    text,
  ].join('\n');

  await atomicWrite(outPath, output);
  return { documentId, extractedPath: outPath, length: text.length, extractor };
}

/**
 * Get the list of supported file extensions for extraction.
 */
export function getSupportedFileTypes() {
  return getSupportedExtensions();
}

/**
 * Extract text from all uploaded documents for a customer.
 * Returns results for each document (success or error).
 */
export async function extractAllDocuments(customerId) {
  const docs = await readDocumentIndex(customerId);
  const uploadable = docs.filter(d => d.status === 'uploaded');

  if (uploadable.length === 0) {
    return { total: 0, results: [] };
  }

  const results = [];

  for (const doc of uploadable) {
    try {
      const result = await extractText(customerId, doc.id);
      await updateDocumentStatus(customerId, doc.id, 'extracted');
      results.push({ documentId: doc.id, filename: doc.filename, status: 'success', ...result });
    } catch (err) {
      await updateDocumentStatus(customerId, doc.id, 'failed', { error: err.message });
      results.push({ documentId: doc.id, filename: doc.filename, status: 'error', error: err.message });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  return { total: uploadable.length, success: successCount, failed: uploadable.length - successCount, results };
}

/* ------------------------------------------------------------------ */
/*  Wiki building (triggers AI processing)                             */
/* ------------------------------------------------------------------ */

/**
 * Build wiki from an extracted document.
 * Acquires customer lock, invokes AI, releases lock.
 */
export async function buildWiki(customerId, documentId) {
  const locked = await acquireLock(customerId);
  if (!locked) {
    throw Object.assign(new Error('Customer is already processing a document'), { code: 'CONFLICT' });
  }

  try {
    await updateDocumentStatus(customerId, documentId, 'processing');

    const { runAI } = await import('./aiService.js');
    const result = await runAI(customerId, documentId);

    await updateDocumentStatus(customerId, documentId, 'wiki_ready');
    return result;
  } catch (err) {
    await updateDocumentStatus(customerId, documentId, 'failed', { error: err.message });
    throw err;
  } finally {
    await releaseLock(customerId);
  }
}
