import { randomUUID } from 'node:crypto';
import {
  customerPath,
  dataPath,
  ensureDir,
  readJSON,
  writeJSON,
  writeMarkdown,
  fileExists,
  listDirs,
} from './fileStore.js';

/* ------------------------------------------------------------------ */
/*  Folder initialisation                                              */
/* ------------------------------------------------------------------ */

async function initCustomerFolder(customerId, name) {
  const base = customerPath(customerId);
  const now = new Date().toISOString();

  // Sub-directories
  await ensureDir(customerPath(customerId, 'raw'));
  await ensureDir(customerPath(customerId, 'extracted'));
  await ensureDir(customerPath(customerId, 'wiki'));

  // config.json
  await writeJSON(customerPath(customerId, 'config.json'), {
    id: customerId,
    name,
    createdAt: now,
    updatedAt: now,
    settings: {
      autoExtract: false,
      autoBuildWiki: false,
      aiModel: 'copilot',
      maxFileSizeMB: 50,
    },
  });

  // index.md
  await writeMarkdown(
    customerPath(customerId, 'index.md'),
    `# Wiki Index — ${name}\n\n_No pages yet. Upload a document to get started._\n`,
  );

  // log.md
  await writeMarkdown(
    customerPath(customerId, 'log.md'),
    `# Activity Log — ${name}\n\n## [${now.split('T')[0]}] init\nCustomer workspace created.\n`,
  );

  // documents.json (aggregate index)
  await writeJSON(customerPath(customerId, 'documents.json'), []);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function createCustomer({ id, name }) {
  const cleanId = (id || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleanId) throw new Error('Invalid customer name');

  if (await fileExists(customerPath(cleanId, 'config.json'))) {
    throw new Error(`Customer "${cleanId}" already exists`);
  }

  await initCustomerFolder(cleanId, name);
  return getCustomer(cleanId);
}

export async function getCustomer(id) {
  const config = await readJSON(customerPath(id, 'config.json'));
  const documents = await readJSON(customerPath(id, 'documents.json'));

  // Count wiki pages by listing .md files in wiki/
  let wikiPageCount = 0;
  try {
    const { listFiles } = await import('./fileStore.js');
    const files = await listFiles(customerPath(id, 'wiki'), '.md');
    wikiPageCount = files.length;
  } catch { /* wiki dir may not exist yet */ }

  return {
    ...config,
    docCount: documents.length,
    wikiPageCount,
  };
}

export async function listCustomers() {
  const ids = await listDirs(dataPath('customers'));
  const customers = [];

  for (const id of ids) {
    try {
      customers.push(await getCustomer(id));
    } catch {
      // Skip invalid/malformed customer dirs
    }
  }

  return customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateCustomer(id, updates) {
  const configPath = customerPath(id, 'config.json');
  const config = await readJSON(configPath);

  if (updates.name) config.name = updates.name;
  if (updates.settings) {
    config.settings = { ...config.settings, ...updates.settings };
  }
  config.updatedAt = new Date().toISOString();

  await writeJSON(configPath, config);
  return getCustomer(id);
}

export async function deleteCustomer(id) {
  const { rm } = await import('node:fs/promises');
  await rm(customerPath(id), { recursive: true, force: true });
}
