import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

const DATA_ROOT = process.env.DATA_ROOT || path.resolve(process.cwd(), 'data');

/* ------------------------------------------------------------------ */
/*  Path helpers                                                       */
/* ------------------------------------------------------------------ */

export function dataPath(...segments) {
  return path.join(DATA_ROOT, ...segments);
}

export function customerPath(customerId, ...segments) {
  return dataPath('customers', customerId, ...segments);
}

export function sharedPath(...segments) {
  return dataPath('shared', ...segments);
}

/* ------------------------------------------------------------------ */
/*  Generic file I/O                                                   */
/* ------------------------------------------------------------------ */

export async function readJSON(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function writeJSON(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export async function readMarkdown(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeMarkdown(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function appendMarkdown(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, content, 'utf-8');
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/*  Directory helpers                                                  */
/* ------------------------------------------------------------------ */

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function listDirs(parentPath) {
  const entries = await fs.readdir(parentPath, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

export async function listFiles(dirPath, ext) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && (!ext || e.name.endsWith(ext)))
      .map(e => e.name);
  } catch { return []; }
}

/* ------------------------------------------------------------------ */
/*  Atomic write (write temp → rename)                                 */
/* ------------------------------------------------------------------ */

export async function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp.' + Date.now();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/* ------------------------------------------------------------------ */
/*  Locking (process-safe per-customer)                                */
/* ------------------------------------------------------------------ */

const LOCK_FILENAME = '.processing.lock';

export async function acquireLock(customerId) {
  const lockPath = customerPath(customerId, LOCK_FILENAME);
  try {
    await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Check if stale
      try {
        const pid = parseInt(await fs.readFile(lockPath, 'utf-8'), 10);
        try { process.kill(pid, 0); } catch { /* pid not alive */ }
        // PID not found → stale lock — but we won't auto-break it yet.
        // Manual recovery for v1. Return false means "busy".
      } catch { /* ignore */ }
      return false;
    }
    throw err;
  }
}

export async function releaseLock(customerId) {
  const lockPath = customerPath(customerId, LOCK_FILENAME);
  try {
    await fs.unlink(lockPath);
  } catch { /* lock may not exist */ }
}

/* ------------------------------------------------------------------ */
/*  Index helpers                                                      */
/* ------------------------------------------------------------------ */

export async function readDocumentIndex(customerId) {
  const indexPath = customerPath(customerId, 'documents.json');
  if (!(await fileExists(indexPath))) return [];
  return readJSON(indexPath);
}

export async function writeDocumentIndex(customerId, docs) {
  await writeJSON(customerPath(customerId, 'documents.json'), docs);
}
