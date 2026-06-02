# CXbox Build Plan

> Generated June 2, 2026 — from the grill session decisions and PRD v0.1.0

---

## Table of Contents

1. [Architecture Decisions](#1-architecture-decisions)
2. [What's Already Built](#2-whats-already-built)
3. [Build Section 3 — Frontend](#3-build-section-3--frontend)
4. [Build Section 4 — Containerization](#4-build-section-4--containerization)
5. [Appendix — Full File Tree](#5-appendix--full-file-tree)

---

## 1. Architecture Decisions

These were settled during the grill session — they supersede any ambiguity in the PRD.

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| **A1** | AI processing model | **CLI-based.** `copilot -p "prompt"` invoked via `child_process.execFile`. The AI agent has filesystem read/write access — it reads extracted text, wiki pages, and schema, and writes `.md` files directly to `wiki/`. No structured output parsing needed. | Avoids complex marker parsing. AI tool does the file I/O. |
| **A2** | Concurrency | **Per-customer `.processing.lock` file.** Express returns `409 Conflict` if lock exists. No job queue in v1 — just reject concurrent requests to the same customer. Stale lock detection: lock file contains PID; check if PID alive on read. | Simple, survives restarts, visible on disk. |
| **A3** | Context passing | **AI CLI agent reads files itself.** The Copilot CLI tool has filesystem tool access. We tell it where the schema, extracted text, and wiki files live. It reads what it needs. No prompt bundling. | Avoids context-window issues. Agent-style interaction. |
| **A4** | Document chunking | **Not needed for v1.** User confirmed docs won't be too long. Each document is processed in a fresh CLI invocation — clean context per document. | Keep it simple. |
| **A5** | Wiki write safety | **Atomic writes.** Write new/updated pages to `.md.tmp.{timestamp}` → validate (has frontmatter, has title, non-empty) → `fs.rename` to final path. | Prevents half-written pages on crash. |
| **A6** | Document list performance | **Aggregate `documents.json` index per customer.** Written on upload, updated on status changes. Single `JSON.parse` per list call — O(1) reads. | Avoids 1000+ individual `readFile` calls. |
| **A7** | Workflow recovery on restart | **Scan on startup.** Any document stuck in `extracting` or `processing` for > 10 minutes gets marked `failed`. Expressed as optional Phase 6 logic. | Container restart doesn't leave dead jobs. |
| **A8** | LLM fallback | **Copilot CLI only for v1.** Ollama fallback deferred. `copilot -p` is the target. If it fails, mark document `failed` and surface error in UI. | Keep v1 focused. |
| **A9** | Frontend framework | **Vue 3 + Vite.** Per PRD. Proxied to Express backend during dev. Built to `public/` for production. | PRD decision, no change. |
| **A10** | Container | **Podman** with `node:22-alpine` base. Single container, volume mount `/data`. | Per PRD. |

---

## 2. What's Already Built

### ✅ Backend (Sections 1 & 2 — Complete)

| File | Purpose | Status |
|------|---------|--------|
| `package.json` | Project config, deps (express, multer, uuid, gray-matter, marked) | Done |
| `src/index.js` | Express server, shared zone init, SPA fallback, health endpoint | Done & tested |
| `src/services/fileStore.js` | File I/O helpers, atomic writes, lock system, index helpers | Done |
| `src/services/customerService.js` | CRUD: create, list, get, update, delete customers | Done & tested |
| `src/routes/customers.js` | REST routes for customer endpoints | Done & tested |
| `data/shared/` | Auto-initialised: `schema.md`, `index.md`, `log.md`, `config.json` | Done |

**Verified:** Server starts → `GET /api/health` returns `ok` → `POST /api/customers` creates folders and returns customer → `GET /api/customers` lists all → folders appear on disk: `raw/`, `extracted/`, `wiki/`, `config.json`, `index.md`, `log.md`, `documents.json`.

### ⚠️ Frontend (Section 3 — Partial)

| File | Purpose | Status |
|------|---------|--------|
| `client/` | Vue 3 + Vite scaffold | Done |
| `client/vite.config.js` | API proxy to :3000, build → `../public` | Done |
| `client/index.html` | Title, favicon | Done |
| `client/src/main.js` | Vue app bootstrap | Done |
| `client/src/style.css` | Design system, dark mode, layout, components | Done |
| `client/src/App.vue` | Shell: header, customer selector, tab bar, status bar | Done |
| `client/src/components/UploadPanel.vue` | Drop zone, file upload to API | Done |

### ❌ Not Yet Built

| File | Purpose |
|------|---------|
| `client/src/components/DocumentsPanel.vue` | Document table, status badges, actions |
| `client/src/components/WikiPanel.vue` | Wiki page browser, sidebar tree, page viewer |
| `client/src/components/QAPanel.vue` | Q&A chat interface, citations |
| `client/src/components/HealthPanel.vue` | Lint trigger, results display |
| `client/src/components/SharedPanel.vue` | Schema editor, shared content viewer |
| `Containerfile` | Podman build configuration |
| Backend: document, wiki, AI, workflow, shared routes | Full feature routes |

---

## 3. Build Section 3 — Frontend

### 3.1 DocumentsPanel.vue

**File:** `client/src/components/DocumentsPanel.vue`

**Responsibilities:**
- Fetch and display document list for the active customer: `GET /api/customers/:id/documents`
- Table columns: Name, Type, Size, Status, Upload Date, Actions
- Status badges with colour coding (uploaded, extracting, extracted, processing, wiki_ready, failed)
- Action buttons per document: Extract, Build Wiki, Delete
- Filter by status (dropdown or clickable filter chips)
- Re-fetch list after any action

**Dependencies:** Requires backend `GET /api/customers/:id/documents` endpoint (not yet built — needs document route added to Section 3 backend work).

**States to handle:**
- Loading (skeleton/spinner)
- Empty (no documents — "Upload your first document" CTA)
- Error (API failure — retry button)
- Loaded (populated table)

**Props:** `customer` object

**Events emitted:** none (refetches internally)

---

### 3.2 WikiPanel.vue

**File:** `client/src/components/WikiPanel.vue`

**Responsibilities:**
- Fetch wiki index: `GET /api/customers/:id/wiki`
- Left sidebar: page tree, grouped by category from index.md
- Main area: rendered markdown from selected page
- Clickable `[[Wiki-Links]]` that navigate to other wiki pages
- Page metadata header (title, type, sources, tags, last updated)
- Search bar for filtering wiki pages by title/content

**States to handle:**
- Loading
- Empty (no wiki pages — "Process a document to build the wiki")
- Error
- Page view with markdown rendering

**Props:** `customer` object

**Markdown rendering strategy:**
- Use `marked` library (already in package.json)
- Custom extension to convert `[[Page-Name]]` to clickable links that update the selected page
- Parse YAML frontmatter with `gray-matter` (available server-side, pass parsed to client)

---

### 3.3 QAPanel.vue

**File:** `client/src/components/QAPanel.vue`

**Responsibilities:**
- Chat-like interface: text input + "Ask" button
- Send question: `POST /api/customers/:id/wiki/query` with `{ question }`
- Display AI answer with markdown rendering
- Inline `[[page-name]]` citations rendered as clickable links
- "File this answer to wiki" button under each answer
- Collapsible chat history stored in component state (in-memory, lost on refresh)

**States to handle:**
- Idle (input ready)
- Loading (question sent, waiting — show typing indicator)
- Answer (markdown rendered with citations)
- Error (AI unavailable, question too vague, etc.)

**Props:** `customer` object

---

### 3.4 HealthPanel.vue

**File:** `client/src/components/HealthPanel.vue`

**Responsibilities:**
- "Run Lint" button → `POST /api/customers/:id/wiki/lint`
- Results displayed in categorised sections:
  - ⚠️ Contradictions
  - 🔗 Orphan pages
  - 📝 Missing cross-references
  - 🔍 Content gaps
- Each item expandable with details
- Last lint timestamp display

**States to handle:**
- Idle ("Run Health Check" button)
- Running (spinner + progress text)
- Results (categorised report)
- Error
- No issues found (green success state)

**Props:** `customer` object

---

### 3.5 SharedPanel.vue

**File:** `client/src/components/SharedPanel.vue`

**Responsibilities:**
- Fetch shared content: `GET /api/shared`
- Markdown editor (textarea or contenteditable) for `schema.md`
- Preview toggle (raw vs rendered markdown)
- "Save Schema" button → `PUT /api/shared/schema`
- Read-only views of shared `index.md` and `log.md`

**States to handle:**
- Loading
- Loaded (split view: editor + preview)
- Saving (button disabled, spinner)
- Error (save failed)

**Props:** none (global, not per-customer)

---

### 3.6 App.vue — Provide dependencies

**Changes needed to existing `client/src/App.vue`:**

Add `provide()` calls so child components can access `toast`, `api`, and `loadCustomers`:

```js
import { provide } from 'vue'

provide('toast', toast)
provide('api', api)
provide('loadCustomers', loadCustomers)
```

Child components use `inject('toast')`, `inject('api')`, etc.

---

### 3.7 Backend routes needed for frontend to work

These backend endpoints must exist before the frontend panels are wired:

| Method | Path | Priority |
|--------|------|----------|
| `POST` | `/api/customers/:id/documents` | P0 — needed by UploadPanel |
| `GET`  | `/api/customers/:id/documents` | P0 — needed by DocumentsPanel |
| `GET`  | `/api/customers/:id/documents/:docId` | P0 |
| `DELETE` | `/api/customers/:id/documents/:docId` | P1 |
| `GET`  | `/api/customers/:id/wiki` | P0 — needed by WikiPanel |
| `GET`  | `/api/customers/:id/wiki/*` | P0 |
| `POST` | `/api/customers/:id/wiki/query` | P0 — needed by QAPanel |
| `POST` | `/api/customers/:id/wiki/lint` | P1 — needed by HealthPanel |
| `GET`  | `/api/shared` | P0 — needed by SharedPanel |
| `PUT`  | `/api/shared/schema` | P1 |
| `POST` | `/api/customers/:id/documents/:docId/extract` | P0 |
| `POST` | `/api/customers/:id/documents/:docId/build-wiki` | P0 |
| `POST` | `/api/customers/:id/documents/:docId/process` | P1 |

**New files needed:**
- `src/routes/documents.js` — document CRUD + upload
- `src/routes/wiki.js` — wiki browsing + query + lint
- `src/routes/shared.js` — shared zone reads/writes
- `src/services/documentService.js` — document metadata, extraction trigger
- `src/services/wikiService.js` — wiki index parsing, page serving, search
- `src/services/aiService.js` — wraps `copilot -p` CLI invocation

---

## 4. Build Section 4 — Containerization

### 4.1 Containerfile

**File:** `Containerfile` (root of project)

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Create data volume mount point
RUN mkdir -p /data
VOLUME /data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_ROOT=/data

CMD ["node", "src/index.js"]
```

### 4.2 Build and run commands

```bash
# Build the image
podman build -t cxbox .

# Run (foreground)
podman run --rm -p 3000:3000 -v ./data:/data cxbox

# Run (detached with auto-restart)
podman run -d --name cxbox -p 3000:3000 -v ./data:/data --restart unless-stopped cxbox

# Stop
podman stop cxbox
podman rm cxbox
```

### 4.3 Notes

- **No compose file needed** — single container.
- **Data portability:** Copy the `./data` directory to another machine, mount it, same container image — all wikis come along.
- **The client build must run before building the container.** `npm run build` (which does `cd client && npm run build`) outputs to `public/`, which gets copied into the image.
- **For development:** Run `node --watch src/index.js` and `npm run dev --prefix client` in parallel. The Vite dev server proxies `/api` to Express.

---

## 5. Appendix — Full File Tree

### Backend (`src/`)

```
src/
├── index.js                         ✅ Express server, init, SPA fallback
├── routes/
│   ├── customers.js                 ✅ Customer CRUD
│   ├── documents.js                 ❌ Document upload, list, CRUD
│   ├── wiki.js                      ❌ Wiki browse, query, lint
│   └── shared.js                    ❌ Shared zone read/write
└── services/
    ├── fileStore.js                 ✅ FS abstraction, locks, atomics
    ├── customerService.js           ✅ Customer init, CRUD
    ├── documentService.js           ❌ Document metadata, extraction
    ├── wikiService.js               ❌ Index parsing, page serving
    └── aiService.js                 ❌ copilot -p wrapper
```

### Frontend (`client/src/`)

```
client/
├── index.html                       ✅
├── vite.config.js                   ✅ api proxy, build output
├── package.json                     ✅
└── src/
    ├── main.js                      ✅
    ├── App.vue                      ✅ shell (needs provide() calls)
    ├── style.css                    ✅ design system
    └── components/
        ├── UploadPanel.vue          ✅ drop zone complete
        ├── DocumentsPanel.vue       ❌ document table + actions
        ├── WikiPanel.vue            ❌ page browser
        ├── QAPanel.vue              ❌ chat interface
        ├── HealthPanel.vue          ❌ lint runner
        └── SharedPanel.vue          ❌ schema editor
```

### Data (`data/`)

```
data/                                ✅ (auto-created on first run)
├── shared/
│   ├── schema.md
│   ├── index.md
│   ├── log.md
│   └── config.json
└── customers/
    └── {id}/
        ├── config.json
        ├── index.md
        ├── log.md
        ├── documents.json
        ├── raw/
        ├── extracted/
        └── wiki/
```

---

## Build Order (Recommended)

1. **Backend routes first** — `documents.js`, `wiki.js`, `shared.js` + their services. Without these, the frontend panels have nothing to call.
2. **Frontend panels** — `DocumentsPanel`, `WikiPanel`, `QAPanel`, `HealthPanel`, `SharedPanel`. Wire each to its backend endpoint.
3. **App.vue wiring** — Add `provide()` for toast, api, loadCustomers. Test all panels.
4. **Containerfile** — Build and verify single-container deployment.
5. **Polish** — Dark mode, responsive, edge-case states.
