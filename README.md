# CXbox — Customer Wiki Manager

AI-curated, multi-customer wikis. Upload documents, extract text, and let AI build and maintain a knowledge base per customer.

**Express.js** backend + **Vue 3** SPA. File-based storage (no database).

---

## Quick Start

### Development

```bash
# Backend
npm run dev          # Node --watch on port 3000

# Frontend (separate terminal)
npm run dev --prefix client   # Vite dev server, proxies /api → :3000
```

### Production Container

```bash
# Build the image (auto-detects podman or docker)
./build-container.sh --tag cxbox:latest

# Run
podman run -d -p 3000:3000 \
  -v $(pwd)/data:/data \
  -v $(pwd)/config:/config:ro \
  -v $(pwd)/copilot-config:/copilot-config \
  -e DATA_ROOT=/data \
  -e CONFIG_ROOT=/config \
  --name cxbox cxbox:latest

# Or with compose
podman-compose up -d
```

---

## Container Build

### `build-container.sh`

One-command script that builds the entire app into a production container:

1. Compiles the Vue 3 frontend (Vite → `public/`)
2. Bundles backend source + production dependencies
3. Builds a container image with Pandoc for document extraction

```bash
./build-container.sh                          # Default tag: cxbox:latest
./build-container.sh --tag myregistry/cxbox:v1.0
./build-container.sh --tag cxbox:latest --push
./build-container.sh --no-cache
```

**Engine**: auto-detects `podman` first, falls back to `docker`.

### Container Architecture

```
┌─────────────────────────────────────────────┐
│  Container (~141 MB)                         │
│                                             │
│  /app/                                      │
│  ├── src/          ← backend code           │
│  ├── public/       ← compiled Vue SPA       │
│  └── node_modules/ ← production deps        │
│                                             │
│  /entrypoint.sh    ← config overlay + start │
│  pandoc            ← document conversion    │
│  copilot           ← GitHub Copilot CLI     │
│                                             │
│  VOLUMES (external, mounted at runtime):    │
│  /data           ← all customer data        │
│  /config         ← optional schema/config   │
│  /copilot-config ← copilot auth & config    │
└─────────────────────────────────────────────┘
```

### External Volumes

| Volume | Purpose | Required |
|--------|---------|----------|
| `/data` | All customer data: documents, extracted text, wiki pages, indexes, per-customer config | Yes |
| `/config` | Override shared zone files (`schema.md`, `config.json`, etc.) | No |
| `/copilot-config` | GitHub Copilot CLI auth tokens & config (persists login) | Yes (for AI features) |

### Copilot CLI Login

The container includes the GitHub Copilot CLI for AI wiki processing. You need to authenticate once — the login persists in `./copilot-config/` across restarts and rebuilds.

```bash
# Login interactively inside the running container
podman exec -it cxbox copilot

# Then run the /login command inside the copilot prompt
# Follow the browser auth flow, then exit
```

Alternatively, use a Personal Access Token:

```bash
podman exec -it cxbox sh -c 'GH_TOKEN=your_pat_here copilot -p "test"'
```

Or set it via environment variable in `docker-compose.yml`:

```yaml
environment:
  - GH_TOKEN=ghp_your_token_here
```

> Requires an active GitHub Copilot subscription. See [Copilot plans](https://github.com/features/copilot/plans).

### Config Overlay

On first boot, the entrypoint copies files from `/config` into `/data/shared/`. It **never overwrites** existing data (`cp -n`).

Place any of these in `./config/`:

| File | Purpose |
|------|---------|
| `schema.md` | AI wiki-maintenance instructions and workflow |
| `config.json` | Global app settings |
| `index.md` | Shared zone index (auto-created if missing) |
| `log.md` | Global activity log (auto-created if missing) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DATA_ROOT` | `/data` | Path to data directory |
| `CONFIG_ROOT` | `/config` | Path to config overlay directory |
| `NODE_ENV` | `production` | Node environment |

---

## Document Extraction

CXbox converts uploaded documents to text for AI processing. Uses **Pandoc** for 30+ formats, with specialized extractors for PDF and spreadsheets.

### Supported Formats

| Format | Extractor | Output |
|--------|-----------|--------|
| `.pdf` | pdf-parse | Plain text |
| `.xlsx`, `.xls` | Custom table extractor | Markdown tables |
| `.csv` | Custom table extractor | Markdown tables |
| `.docx`, `.doc` | Pandoc | Markdown |
| `.odt` | Pandoc | Markdown |
| `.rtf` | Pandoc | Markdown |
| `.html`, `.htm` | Pandoc | Markdown |
| `.epub` | Pandoc | Markdown |
| `.pptx` | Pandoc | Markdown |
| `.tex`, `.latex` | Pandoc | Markdown |
| `.org` | Pandoc | Markdown |
| `.opml` | Pandoc | Markdown |
| `.tsv` | Pandoc | Markdown |
| `.txt`, `.md` | Pass-through | As-is |
| + 15 more | Pandoc | Markdown |

### API Endpoints

```
POST /api/customers/:id/documents              # Upload a file
GET  /api/customers/:id/documents              # List all documents
GET  /api/customers/:id/documents/:docId       # Get document details
DELETE /api/customers/:id/documents/:docId     # Delete a document

POST /api/customers/:id/documents/:docId/extract       # Extract text
POST /api/customers/:id/documents/extract-all           # Batch extract all
POST /api/customers/:id/documents/:docId/build-wiki     # Build wiki from doc
POST /api/customers/:id/documents/:docId/process        # Extract + build wiki

GET  /api/customers/:id/documents/supported-types       # List supported formats
```

### Document Lifecycle

```
uploaded → extracting → extracted → processing → wiki_ready
                                    ↓
                                  failed
```

---

## Data Layout

All state is files. No database.

```
data/
├── shared/                    # Global zone
│   ├── schema.md              # AI instructions
│   ├── config.json            # Global settings
│   ├── index.md               # Shared index
│   └── log.md                 # Activity log
│
└── customers/{id}/            # Per-customer zone
    ├── config.json            # Customer settings
    ├── documents.json         # Document index (aggregate)
    ├── index.md               # Wiki page catalog
    ├── log.md                 # Customer activity log
    ├── raw/                   # Uploaded files (immutable)
    ├── extracted/             # Extracted text ({docId}.txt)
    └── wiki/                  # Generated wiki pages (.md)
```

---

## Project Structure

```
CXbox/
├── src/
│   ├── index.js               # Entry: middleware, routes, SPA fallback, init
│   ├── routes/
│   │   ├── customers.js       # Customer CRUD
│   │   ├── documents.js       # Upload, extract, process
│   │   ├── wiki.js            # Wiki page CRUD
│   │   └── shared.js          # Shared zone API
│   └── services/
│       ├── fileStore.js       # FS abstraction, atomic writes, locking
│       ├── customerService.js # Customer CRUD, folder init
│       ├── documentService.js # Document lifecycle, extraction, wiki build
│       ├── wikiService.js     # Wiki page CRUD, link validation
│       ├── aiService.js       # Copilot CLI wrapper
│       └── extractors/
│           ├── index.js       # Extractor registry/router
│           ├── pandoc.js      # Universal converter (30+ formats)
│           ├── pdf.js         # PDF text extraction
│           ├── xlsx.js        # Spreadsheet → markdown tables
│           └── csv.js         # CSV → markdown tables
│
├── client/                    # Vue 3 SPA (Vite)
│   └── src/
│       ├── App.vue            # Shell: header, tabs, status, toast
│       ├── style.css          # Design tokens, dark mode
│       └── components/        # Panel components
│
├── public/                    # Built frontend (output of vite build)
├── data/                      # All application state (files)
├── config/                    # External config overrides
├── copilot-config/            # Copilot CLI auth tokens (gitignored)
│
├── Containerfile              # Production container definition
├── entrypoint.sh              # Config overlay + app start
├── build-container.sh         # Build script (podman/docker)
├── docker-compose.yml         # Compose file
└── package.json
```

---

## Architecture Notes

- **ESM**: All imports need `.js` extension
- **Atomic writes**: `fileStore.atomicWrite()` — write to `.tmp.{timestamp}`, then `fs.rename`
- **Customer locking**: `fileStore.acquireLock(id)` — prevents concurrent AI processing
- **Error responses**: `{ error: { code: 'INTERNAL' | 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST', message: '...' } }`
- **SPA fallback**: Express serves `public/index.html` for all non-`/api/` routes
- **Frontend DI**: Child components use `inject('toast')`, `inject('api')` — provided by App.vue
- **Wiki pages**: Markdown with YAML frontmatter, `[[Wiki-Links]]` for cross-references
- **AI processing**: Uses `copilot -p "prompt"` CLI. Agent reads files itself — no prompt bundling.
