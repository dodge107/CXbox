# AGENTS.md — CXbox

## Project

Customer Wiki Manager — AI-curated, multi-customer wikis. Express.js backend + Vue 3 SPA. File-based storage (no database).

## Commands

| Task | Command |
|------|---------|
| Dev — backend | `npm run dev` (Node 22+ `--watch`) |
| Dev — frontend | `npm run dev --prefix client` (Vite, proxies `/api` → `:3000`) |
| Build client | `npm run build` (outputs to `public/`) |
| Start prod | `npm start` |
| Env | `PORT` (default 3000), `DATA_ROOT` (default `./data`) |

No test runner, linter, or type checker configured yet.

## Architecture

**Backend** (`src/`) — Express 4, ESM (`"type": "module"`). All imports need `.js` extension.

```
src/
├── index.js              ← entry: middleware, routes, SPA fallback, shared zone init
├── routes/
│   ├── customers.js      ← GET/POST/PUT/DELETE /api/customers
│   ├── documents.js      ← GET/POST/DELETE /api/customers/:id/documents
│   ├── wiki.js           ← GET/POST/PUT/DELETE /api/customers/:id/wiki
│   └── shared.js         ← GET/PUT /api/shared/{schema|index|log|config}
└── services/
    ├── fileStore.js      ← FS abstraction: path helpers, atomic writes, per-customer locks, document index
    ├── customerService.js ← CRUD, folder init (raw/, extracted/, wiki/, config.json, index.md, log.md, documents.json)
    ├── documentService.js ← upload, extract, list, get, delete documents
    ├── wikiService.js    ← wiki page CRUD, index management, link validation
    └── aiService.js      ← copilot CLI wrapper for AI processing
```

**Frontend** (`client/`) — Vue 3 Composition API + Vite.

```
client/src/
├── App.vue               ← shell: header, customer selector, tab bar, status bar, toast container
├── style.css             ← design tokens (CSS custom props), dark mode via prefers-color-scheme
└── components/
    ├── UploadPanel.vue   ← ✅ done
    ├── DocumentsPanel.vue
    ├── WikiPanel.vue
    ├── QAPanel.vue
    ├── HealthPanel.vue
    └── SharedPanel.vue
```

**Data** (`data/`) — all state is files.

```
data/
├── shared/               ← global: schema.md, index.md, log.md, config.json
└── customers/{id}/       ← per-customer: config.json, index.md, log.md, documents.json, raw/, extracted/, wiki/
```

## Key Conventions

- **Error responses**: `{ error: { code: 'INTERNAL' | 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST', message: '...' } }`
- **Section dividers**: `/* --- Section Name --- */` in JS files
- **Atomic writes**: `fileStore.atomicWrite()` — write to `.tmp.{timestamp}`, then `fs.rename`
- **Customer locking**: `fileStore.acquireLock(id)` — creates `.processing.lock` with PID. Returns `false` if busy.
- **Document index**: `documents.json` aggregate per customer — NOT individual sidecars. Read once, O(1).
- **Customer ID**: slugified from name (`"Acme Corp"` → `"acme-corp"`). Lowercase, hyphens, alphanumeric only.
- **SPA fallback**: Express serves `public/index.html` for all non-`/api/` routes.
- **Frontend DI**: Child components use `inject('toast')`, `inject('api')`, `inject('loadCustomers')` — provided by App.vue.
- **Toast system**: `toast(message, type)` — auto-dismisses after 3s with fade-out animation. Types: `'success'` (default), `'error'`. Uses Vue `<TransitionGroup>` for enter/leave transitions.
- **Wiki pages**: Markdown with YAML frontmatter. `[[Wiki-Links]]` for cross-references.

## AI Processing

- Uses `copilot -p "prompt"` CLI (not REST API). Agent has filesystem read/write access.
- One document at a time per customer. Lock prevents concurrent processing.
- Context: agent reads files itself (schema, extracted text, wiki pages) — no prompt bundling.
- No chunking needed for v1 (docs assumed short enough for context window).

## What's Missing (v1)

- Containerfile
- Tests, linting, type checking

## Build Plan

See `BUILD_PLAN.md` for the complete implementation roadmap with file-by-file specs.
