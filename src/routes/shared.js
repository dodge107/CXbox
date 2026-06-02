import { Router } from 'express';
import {
  sharedPath,
  readMarkdown,
  readJSON,
  atomicWrite,
  fileExists,
} from '../services/fileStore.js';

const router = Router();

/* ------------------------------------------------------------------ */
/*  GET /api/shared — get all shared content                           */
/* ------------------------------------------------------------------ */

router.get('/', async (_req, res) => {
  try {
    const result = {};

    // schema.md
    const schemaPath = sharedPath('schema.md');
    if (await fileExists(schemaPath)) {
      result.schema = await readMarkdown(schemaPath);
    }

    // index.md
    const indexPath = sharedPath('index.md');
    if (await fileExists(indexPath)) {
      result.index = await readMarkdown(indexPath);
    }

    // log.md
    const logPath = sharedPath('log.md');
    if (await fileExists(logPath)) {
      result.log = await readMarkdown(logPath);
    }

    // config.json
    const configPath = sharedPath('config.json');
    if (await fileExists(configPath)) {
      result.config = await readJSON(configPath);
    }

    res.json(result);
  } catch (err) {
    console.error('Failed to read shared content:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/shared/:file — get a specific shared file                 */
/* ------------------------------------------------------------------ */

router.get('/:file', async (req, res) => {
  try {
    const { file } = req.params;
    const filePath = sharedPath(file);

    if (!(await fileExists(filePath))) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Shared file "${file}" not found` } });
    }

    if (file.endsWith('.json')) {
      const data = await readJSON(filePath);
      res.json(data);
    } else {
      const content = await readMarkdown(filePath);
      res.json({ filename: file, content });
    }
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('Failed to read shared file:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /api/shared/schema — update schema.md                          */
/* ------------------------------------------------------------------ */

router.put('/schema', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Content is required' } });
    }

    const schemaPath = sharedPath('schema.md');
    await atomicWrite(schemaPath, content);
    res.json({ success: true, file: 'schema.md' });
  } catch (err) {
    console.error('Failed to update schema:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /api/shared/:file — update a shared file                       */
/* ------------------------------------------------------------------ */

router.put('/:file', async (req, res) => {
  try {
    const { file } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Content is required' } });
    }

    // Safety: only allow .md and .json files
    if (!file.endsWith('.md') && !file.endsWith('.json')) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only .md and .json files can be updated' } });
    }

    const filePath = sharedPath(file);
    if (!(await fileExists(filePath))) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Shared file "${file}" not found` } });
    }

    await atomicWrite(filePath, content);
    res.json({ success: true, file });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('Failed to update shared file:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;
