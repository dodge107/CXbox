import { Router } from 'express';
import {
  parseWikiIndex,
  getWikiPage,
  listWikiPages,
  searchWiki,
  lintWiki,
} from '../services/wikiService.js';
import { queryAI, lintAI } from '../services/aiService.js';

const router = Router({ mergeParams: true });

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/wiki — list wiki index                      */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  try {
    const { pages, raw } = await parseWikiIndex(req.params.id);
    const allPages = await listWikiPages(req.params.id);
    res.json({ pages, allPages, raw });
  } catch (err) {
    console.error('Failed to list wiki:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/wiki/search?q=...                           */
/* ------------------------------------------------------------------ */

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Query parameter "q" is required' } });
    }
    const results = await searchWiki(req.params.id, q);
    res.json(results);
  } catch (err) {
    console.error('Failed to search wiki:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/wiki/pages                                  */
/* ------------------------------------------------------------------ */

router.get('/pages', async (req, res) => {
  try {
    const pages = await listWikiPages(req.params.id);
    res.json(pages);
  } catch (err) {
    console.error('Failed to list wiki pages:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/customers/:id/wiki/* — get a specific page                */
/* ------------------------------------------------------------------ */

router.get('/*', async (req, res) => {
  try {
    const pageName = req.params[0];
    if (!pageName) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Page name is required' } });
    }
    const page = await getWikiPage(req.params.id, pageName);
    res.json(page);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('Failed to get wiki page:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/wiki/query — ask a question                */
/* ------------------------------------------------------------------ */

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Question is required' } });
    }

    const result = await queryAI(req.params.id, question.trim());
    res.json(result);
  } catch (err) {
    console.error('Failed to query wiki:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/customers/:id/wiki/lint — run health check               */
/* ------------------------------------------------------------------ */

router.post('/lint', async (req, res) => {
  try {
    // Run both static lint and AI lint in parallel
    const [staticLint, aiLint] = await Promise.allSettled([
      lintWiki(req.params.id),
      lintAI(req.params.id),
    ]);

    const result = {
      static: staticLint.status === 'fulfilled' ? staticLint.value : { error: staticLint.reason?.message },
      ai: aiLint.status === 'fulfilled' ? aiLint.value : { error: aiLint.reason?.message },
    };

    res.json(result);
  } catch (err) {
    console.error('Failed to lint wiki:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;
