import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataPath, sharedPath, ensureDir, writeJSON, readJSON, writeMarkdown, fileExists } from './services/fileStore.js';
import customerRoutes from './routes/customers.js';
import documentRoutes from './routes/documents.js';
import wikiRoutes from './routes/wiki.js';
import sharedRoutes from './routes/shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

/* ------------------------------------------------------------------ */
/*  API routes                                                         */
/* ------------------------------------------------------------------ */

app.use('/api/customers', customerRoutes);
app.use('/api/customers/:id/documents', documentRoutes);
app.use('/api/customers/:id/wiki', wikiRoutes);
app.use('/api/shared', sharedRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/* ------------------------------------------------------------------ */
/*  SPA fallback — serve index.html for all non-api, non-static routes  */
/* ------------------------------------------------------------------ */

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

async function initSharedZone() {
  await ensureDir(sharedPath());

  const schemaPath = sharedPath('schema.md');
  if (!(await fileExists(schemaPath))) {
    const defaultSchema = `# CXbox Wiki Schema

## Role
You are a wiki maintainer. You read source documents and update
the customer's wiki with accuracy and precision.

## Directory Structure
- \`raw/\` — Immutable source documents. Read only. Never modify.
- \`wiki/\` — Your generated markdown pages. You own this layer.
- \`index.md\` — Catalog of all wiki pages. Keep current.
- \`log.md\` — Append-only activity record.

## Page Types
- **entity** — People, companies, products, locations
- **concept** — Ideas, processes, policies, terms
- **source-summary** — One page per ingested document
- **synthesis** — Cross-cutting analysis pulling from multiple sources

## Conventions
- Every page MUST have YAML frontmatter with: title, type, sources, tags
- Use \`[[Wiki-Links]]\` for all cross-references
- Cite documents using their ID: \`[^src-{docId}]\`
- Flag contradictions with ⚠️ at the start of the paragraph
- Never modify files in \`raw/\` or \`extracted/\`

## Ingest Workflow
1. Read the extracted text file
2. Identify: entities, concepts, claims, dates, numbers
3. Search existing wiki for related pages (use index.md)
4. For each finding: either update an existing page or create new
5. Add \`[[Wiki-Links]]\` to connect new content to existing pages
6. Add source citations
7. Add/update YAML frontmatter
8. Update \`index.md\` with new/changed pages
9. Append to \`log.md\` with timestamp and summary
10. Return a summary of changes made

## Query Workflow
1. Read \`index.md\` to find the most relevant pages
2. Read full content of those pages
3. Synthesize an answer using only information from the wiki
4. Cite specific pages inline: [[Page-Name]]
5. If the wiki lacks information to answer, state so clearly
6. Suggest what new sources might fill the gap
`;
    await writeMarkdown(schemaPath, defaultSchema);
    console.log('Initialised shared/schema.md');
  }

  const indexPath = sharedPath('index.md');
  if (!(await fileExists(indexPath))) {
    await writeMarkdown(indexPath, '# Shared Zone Index\n\n_No shared content yet._\n');
  }

  const logPath = sharedPath('log.md');
  if (!(await fileExists(logPath))) {
    await writeMarkdown(logPath, `# Global Activity Log\n\n## [${new Date().toISOString().split('T')[0]}] init\nCXbox shared zone initialised.\n`);
  }

  const configPath = sharedPath('config.json');
  if (!(await fileExists(configPath))) {
    await writeJSON(configPath, {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      settings: {
        defaultAiModel: 'copilot',
        maxFileSizeMB: 50,
      },
    });
  }
}

async function main() {
  await ensureDir(dataPath());
  await ensureDir(dataPath('customers'));
  await initSharedZone();
  console.log('Shared zone ready');

  app.listen(PORT, () => {
    console.log(`CXbox running at http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start CXbox:', err);
  process.exit(1);
});
