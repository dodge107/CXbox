import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  getDocuments,
  getDocument,
  addDocument,
  deleteDocument,
  extractText,
  extractAllDocuments,
  buildWiki,
  updateDocumentStatus,
  getSupportedFileTypes,
} from '../services/documentService.js';
import { customerPath, fileExists } from '../services/fileStore.js';

const router = Router({ mergeParams: true });

/* ------------------------------------------------------------------ */
/*  Multer config — store uploads in customer's raw/ dir               */
/* ------------------------------------------------------------------ */

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawDir = customerPath(req.params.id, 'raw');
    cb(null, rawDir);
  },
  filename: (_req, file, cb) => {
    // Use original name, but sanitize
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/epub+zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [
      '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.md',
      '.html', '.htm', '.rtf', '.odt', '.epub', '.pptx', '.tex', '.latex',
      '.org', '.opml', '.tsv',
    ];
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext || file.mimetype} not supported`));
    }
  },
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/documents — upload file                    */
/* ------------------------------------------------------------------ */

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
    }

    const doc = await addDocument(req.params.id, req.file.originalname, req.file.size);
    res.status(201).json(doc);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    console.error('Failed to upload document:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/documents — list all                        */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  try {
    const docs = await getDocuments(req.params.id);
    res.json(docs);
  } catch (err) {
    console.error('Failed to list documents:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/documents/supported-types                   */
/*  Return list of supported file extensions                           */
/* ------------------------------------------------------------------ */

router.get('/supported-types', (_req, res) => {
  res.json({ extensions: getSupportedFileTypes() });
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/documents/extract-all                      */
/*  Batch extract all uploaded documents                               */
/* ------------------------------------------------------------------ */

router.post('/extract-all', async (req, res) => {
  try {
    const result = await extractAllDocuments(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Failed to extract all documents:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/documents/:docId — get one                  */
/* ------------------------------------------------------------------ */

router.get('/:docId', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id, req.params.docId);
    res.json(doc);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('Failed to get document:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/customers/:id/documents/:docId                         */
/* ------------------------------------------------------------------ */

router.delete('/:docId', async (req, res) => {
  try {
    await deleteDocument(req.params.id, req.params.docId);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('Failed to delete document:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/documents/:docId/extract                   */
/* ------------------------------------------------------------------ */

router.post('/:docId/extract', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id, req.params.docId);
    if (doc.status !== 'uploaded') {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: `Document is in "${doc.status}" status, must be "uploaded"` },
      });
    }

    await updateDocumentStatus(req.params.id, req.params.docId, 'extracting');
    const result = await extractText(req.params.id, req.params.docId);
    const updated = await updateDocumentStatus(req.params.id, req.params.docId, 'extracted');

    res.json({ ...result, document: updated });
  } catch (err) {
    await updateDocumentStatus(req.params.id, req.params.docId, 'failed', { error: err.message });
    console.error('Failed to extract document:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/documents/:docId/build-wiki                */
/* ------------------------------------------------------------------ */

router.post('/:docId/build-wiki', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id, req.params.docId);
    if (doc.status !== 'extracted') {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: `Document is in "${doc.status}" status, must be "extracted"` },
      });
    }

    const result = await buildWiki(req.params.id, req.params.docId);
    res.json(result);
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: err.message } });
    }
    console.error('Failed to build wiki:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/documents/:docId/process                   */
/*  Convenience: extract + build-wiki in one call                      */
/* ------------------------------------------------------------------ */

router.post('/:docId/process', async (req, res) => {
  try {
    const doc = await getDocument(req.params.id, req.params.docId);
    if (!['uploaded', 'extracted'].includes(doc.status)) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: `Document is in "${doc.status}" status, must be "uploaded" or "extracted"` },
      });
    }

    // Extract if needed
    if (doc.status === 'uploaded') {
      await updateDocumentStatus(req.params.id, req.params.docId, 'extracting');
      await extractText(req.params.id, req.params.docId);
      await updateDocumentStatus(req.params.id, req.params.docId, 'extracted');
    }

    // Build wiki
    const result = await buildWiki(req.params.id, req.params.docId);
    res.json(result);
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: err.message } });
    }
    console.error('Failed to process document:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;
