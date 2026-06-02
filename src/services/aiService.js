import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  customerPath,
  sharedPath,
  readMarkdown,
  fileExists,
  appendMarkdown,
} from './fileStore.js';

const exec = promisify(execFile);

/* ------------------------------------------------------------------ */
/*  AI service — wraps `copilot -p` CLI                                */
/* ------------------------------------------------------------------ */

/**
 * Run the AI agent to process a document and build wiki pages.
 *
 * The copilot CLI has filesystem access — it reads extracted text,
 * wiki pages, schema, and writes directly to the wiki/ directory.
 */
export async function runAI(customerId, documentId) {
  const extractedPath = customerPath(customerId, 'extracted', documentId + '.txt');
  const wikiDir = customerPath(customerId, 'wiki');
  const indexPath = customerPath(customerId, 'wiki', 'index.md');
  const logPath = customerPath(customerId, 'log.md');
  const schemaPath = sharedPath('schema.md');

  // Verify extracted text exists
  if (!(await fileExists(extractedPath))) {
    throw new Error('Extracted text file not found — run extraction first');
  }

  const extractedContent = await readMarkdown(extractedPath);
  const schema = await fileExists(schemaPath) ? await readMarkdown(schemaPath) : '';
  const indexContent = await fileExists(indexPath) ? await readMarkdown(indexPath) : '';

  // Build the prompt for the AI agent
  const prompt = buildIngestPrompt({
    schema,
    extractedContent,
    indexContent,
    wikiDir,
    documentId,
  });

  try {
    // Invoke copilot CLI
    const { stdout, stderr } = await exec('copilot', ['-p', prompt], {
      timeout: 5 * 60 * 1000, // 5 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    // Log the activity
    const now = new Date().toISOString();
    await appendMarkdown(logPath, `\n## [${now.split('T')[0]}] wiki-build\nDocument ${documentId} processed by AI.\n${stdout ? 'Output: ' + stdout.slice(0, 500) : 'Completed.'}\n`);

    return {
      success: true,
      documentId,
      output: stdout?.slice(0, 2000) || 'Completed',
    };
  } catch (err) {
    const errorMsg = err.stderr || err.message || 'AI processing failed';
    await appendMarkdown(logPath, `\n## [${new Date().toISOString().split('T')[0]}] wiki-build-failed\nDocument ${documentId} failed: ${errorMsg.slice(0, 500)}\n`);
    throw new Error(`AI processing failed: ${errorMsg.slice(0, 500)}`);
  }
}

/**
 * Run the AI agent to answer a question from the wiki.
 */
export async function queryAI(customerId, question) {
  const wikiDir = customerPath(customerId, 'wiki');
  const indexPath = customerPath(customerId, 'wiki', 'index.md');
  const schemaPath = sharedPath('schema.md');

  const schema = await fileExists(schemaPath) ? await readMarkdown(schemaPath) : '';
  const indexContent = await fileExists(indexPath) ? await readMarkdown(indexPath) : '';

  const prompt = buildQueryPrompt({
    schema,
    indexContent,
    wikiDir,
    question,
  });

  try {
    const { stdout } = await exec('copilot', ['-p', prompt], {
      timeout: 3 * 60 * 1000,
      maxBuffer: 50 * 1024 * 1024,
    });

    return {
      success: true,
      answer: stdout || 'No answer generated.',
    };
  } catch (err) {
    throw new Error(`AI query failed: ${(err.stderr || err.message).slice(0, 500)}`);
  }
}

/**
 * Run the AI agent to lint the wiki.
 */
export async function lintAI(customerId) {
  const wikiDir = customerPath(customerId, 'wiki');
  const indexPath = customerPath(customerId, 'wiki', 'index.md');
  const schemaPath = sharedPath('schema.md');

  const schema = await fileExists(schemaPath) ? await readMarkdown(schemaPath) : '';
  const indexContent = await fileExists(indexPath) ? await readMarkdown(indexPath) : '';

  const prompt = buildLintPrompt({
    schema,
    indexContent,
    wikiDir,
  });

  try {
    const { stdout } = await exec('copilot', ['-p', prompt], {
      timeout: 5 * 60 * 1000,
      maxBuffer: 50 * 1024 * 1024,
    });

    return {
      success: true,
      report: stdout || 'Lint completed.',
    };
  } catch (err) {
    throw new Error(`AI lint failed: ${(err.stderr || err.message).slice(0, 500)}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt builders                                                    */
/* ------------------------------------------------------------------ */

function buildIngestPrompt({ schema, extractedContent, indexContent, wikiDir, documentId }) {
  return `You are a wiki maintainer. Follow this schema:

${schema}

---

DOCUMENT TO INGEST (ID: ${documentId}):
${extractedContent.slice(0, 20000)}

---

CURRENT WIKI INDEX:
${indexContent}

---

WIKI DIRECTORY: ${wikiDir}

TASK:
1. Read the extracted text above
2. Read existing wiki pages in ${wikiDir} (use index.md to find them)
3. For each entity, concept, or claim found:
   - Update an existing page if relevant
   - Create a new page if it doesn't exist
   - Add [[Wiki-Links]] to connect content
   - Add source citations using [^src-${documentId}]
4. Every page MUST have YAML frontmatter with: title, type, sources, tags
5. Update index.md with any new or changed pages
6. Append to log.md with a summary

Return a summary of what you did.`;
}

function buildQueryPrompt({ schema, indexContent, wikiDir, question }) {
  return `You are a wiki assistant. Follow this schema:

${schema}

---

WIKI INDEX:
${indexContent}

---

WIKI DIRECTORY: ${wikiDir}

---

QUESTION: ${question}

TASK:
1. Read index.md to find the most relevant wiki pages
2. Read the full content of those pages
3. Synthesize an answer using ONLY information from the wiki
4. Cite specific pages inline using [[Page-Name]] format
5. If the wiki lacks information to answer, state so clearly
6. Suggest what new sources might fill the gap

Answer the question now:`;
}

function buildLintPrompt({ schema, indexContent, wikiDir }) {
  return `You are a wiki quality auditor. Follow this schema:

${schema}

---

WIKI INDEX:
${indexContent}

---

WIKI DIRECTORY: ${wikiDir}

---

TASK: Audit the wiki for these issues:
1. **Contradictions** — Pages that make conflicting claims
2. **Orphan pages** — Files not listed in index.md
3. **Missing cross-references** — Pages that should link to each other but don't
4. **Content gaps** — Entries in index.md with missing files, or pages missing frontmatter

For each issue found, report:
- The page(s) involved
- The specific problem
- A suggested fix

If no issues found, report "Wiki is healthy."`;
}
