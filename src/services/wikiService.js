import fs from 'node:fs/promises';
import matter from 'gray-matter';
import {
  customerPath,
  readMarkdown,
  fileExists,
  listFiles,
  atomicWrite,
} from './fileStore.js';

/* ------------------------------------------------------------------ */
/*  Wiki index parsing                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse the customer's wiki index.md and return structured page list.
 * Looks for lines matching: - [[Page-Name]] — Description
 */
export async function parseWikiIndex(customerId) {
  const indexPath = customerPath(customerId, 'wiki', 'index.md');
  if (!(await fileExists(indexPath))) {
    return { pages: [], raw: '' };
  }

  const raw = await readMarkdown(indexPath);
  const pages = [];

  // Parse index entries: "- [[Page-Name]] — Description" or "- [[Page-Name]]: Description"
  const entryRegex = /^[-*]\s*\[\[([^\]]+)\]\]\s*[—\-:]\s*(.+)$/gm;
  let match;
  while ((match = entryRegex.exec(raw)) !== null) {
    pages.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });
  }

  return { pages, raw };
}

/**
 * Get a wiki page by name (filename).
 * Returns { frontmatter, content, raw } or throws.
 */
export async function getWikiPage(customerId, pageName) {
  // Normalize: .md extension optional
  const filename = pageName.endsWith('.md') ? pageName : pageName + '.md';
  const filePath = customerPath(customerId, 'wiki', filename);

  if (!(await fileExists(filePath))) {
    throw Object.assign(new Error(`Wiki page "${pageName}" not found`), { code: 'NOT_FOUND' });
  }

  const raw = await readMarkdown(filePath);
  const parsed = matter(raw);

  return {
    name: pageName.replace(/\.md$/, ''),
    filename,
    frontmatter: parsed.data || {},
    content: parsed.content,
    raw,
  };
}

/**
 * List all wiki pages (just filenames).
 */
export async function listWikiPages(customerId) {
  const wikiDir = customerPath(customerId, 'wiki');
  const files = await listFiles(wikiDir, '.md');
  // Exclude index.md from the page list
  return files.filter(f => f !== 'index.md').sort();
}

/**
 * Search wiki pages by title or content.
 */
export async function searchWiki(customerId, query) {
  const pages = await listWikiPages(customerId);
  const results = [];
  const lowerQuery = query.toLowerCase();

  for (const filename of pages) {
    const page = await getWikiPage(customerId, filename);
    const title = (page.frontmatter.title || page.name).toLowerCase();
    const content = page.content.toLowerCase();

    if (title.includes(lowerQuery) || content.includes(lowerQuery)) {
      results.push({
        name: page.name,
        title: page.frontmatter.title || page.name,
        type: page.frontmatter.type || 'unknown',
        tags: page.frontmatter.tags || [],
        // Snippet of matching content
        snippet: extractSnippet(page.content, query),
      });
    }
  }

  return results;
}

/** Extract a short snippet around the query match */
function extractSnippet(content, query, contextLen = 80) {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, contextLen * 2);
  const start = Math.max(0, idx - contextLen);
  const end = Math.min(content.length, idx + query.length + contextLen);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet += '...';
  return snippet;
}

/* ------------------------------------------------------------------ */
/*  Wiki page writing                                                  */
/* ------------------------------------------------------------------ */

/**
 * Save a wiki page with frontmatter.
 */
export async function saveWikiPage(customerId, pageName, title, type, content, sources = [], tags = []) {
  const filename = pageName.endsWith('.md') ? pageName : pageName + '.md';
  const filePath = customerPath(customerId, 'wiki', filename);

  const frontmatter = {
    title,
    type,
    sources,
    tags,
    updatedAt: new Date().toISOString(),
  };

  const fullContent = matter.stringify(content, frontmatter);
  await atomicWrite(filePath, fullContent);

  return { name: pageName, filename, frontmatter, content };
}

/**
 * Update the wiki index.md with a page entry.
 */
export async function updateWikiIndex(customerId, pageName, description) {
  const indexPath = customerPath(customerId, 'wiki', 'index.md');
  let raw = '';

  if (await fileExists(indexPath)) {
    raw = await readMarkdown(indexPath);
  } else {
    raw = '# Wiki Index\n\n';
  }

  // Check if entry already exists
  const entryPattern = new RegExp(`^[-*]\\s*\\[\\[${pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'm');
  if (entryPattern.test(raw)) {
    // Update existing entry
    const updated = raw.replace(
      new RegExp(`^([-*]\\s*\\[\\[${pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]\\s*[—\\-:]\\s*).+$`, 'm'),
      `$1${description}`
    );
    await atomicWrite(indexPath, updated);
  } else {
    // Append new entry
    const entry = `- [[${pageName}]] — ${description}\n`;
    await atomicWrite(indexPath, raw + entry);
  }
}

/* ------------------------------------------------------------------ */
/*  Wiki linting                                                       */
/* ------------------------------------------------------------------ */

/**
 * Run a health check on the wiki.
 * Returns categorized issues.
 */
export async function lintWiki(customerId) {
  const { pages } = await parseWikiIndex(customerId);
  const allFiles = await listWikiPages(customerId);
  const issues = {
    contradictions: [],
    orphanPages: [],
    missingCrossRefs: [],
    contentGaps: [],
  };

  const indexedNames = new Set(pages.map(p => p.name));
  const fileNames = new Set(allFiles.map(f => f.replace(/\.md$/, '')));

  // Orphan pages: files not in index
  for (const name of fileNames) {
    if (!indexedNames.has(name)) {
      issues.orphanPages.push({ page: name, issue: 'File exists but not in index.md' });
    }
  }

  // Missing pages: in index but no file
  for (const page of pages) {
    if (!fileNames.has(page.name)) {
      issues.contentGaps.push({ page: page.name, issue: 'Listed in index.md but file missing' });
    }
  }

  // Check for missing frontmatter
  for (const filename of allFiles) {
    const page = await getWikiPage(customerId, filename);
    if (!page.frontmatter.title) {
      issues.contentGaps.push({ page: page.name, issue: 'Missing title in frontmatter' });
    }
    if (!page.frontmatter.type) {
      issues.contentGaps.push({ page: page.name, issue: 'Missing type in frontmatter' });
    }
  }

  return {
    issues,
    totalIssues: Object.values(issues).flat().length,
    pageCount: fileNames.size,
    indexedCount: pages.length,
    lintedAt: new Date().toISOString(),
  };
}
