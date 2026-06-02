# Product Requirements Document (PRD)

## Customer Wiki Manager — CXbox

---

| Property | Detail |
|----------|--------|
| **Status** | Draft — Planning Phase |
| **Version** | 0.1.0 |
| **Date** | June 2, 2026 |
| **Author** | CXbox Team |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [User Personas](#4-user-personas)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Architecture Overview](#7-architecture-overview)
8. [Data Model](#8-data-model)
9. [API Design](#9-api-design)
10. [UI/UX Requirements](#10-uiux-requirements)
11. [AI Integration Requirements](#11-ai-integration-requirements)
12. [Workflow Engine Requirements](#12-workflow-engine-requirements)
13. [Implementation Phases](#13-implementation-phases)
14. [Risk Assessment](#14-risk-assessment)
15. [Technology Stack](#15-technology-stack)
16. [Open Questions](#16-open-questions)
17. [Appendix](#17-appendix)

---

## 1. Executive Summary

**Customer Wiki Manager** is a self-hosted, container-based web application that enables organizations to manage structured knowledge bases (wikis) for multiple customers. The product applies the **LLM-Wiki pattern** described by Andrej Karpathy — a three-layer architecture where an AI agent incrementally builds and maintains a persistent, cross-linked wiki from raw source documents.

### Key Capabilities

- Upload business documents (PDF, DOCX, XLSX, CSV, TXT, MD) into a customer-specific dashboard
- AI automatically extracts, summarizes, and cross-links knowledge into a structured wiki
- Teams query the wiki in natural language and receive cited, synthesized answers
- Simple workflow engine tracks document processing status
- Multi-customer isolation via folder-scoped data with a shared "How We Work" knowledge zone
- Runs entirely within a single Podman container — no external database, no cloud dependency

### Why This Exists

Most document management tools are either dumb file storage or full-blown ECM systems. This product occupies a new space: **AI-curated, customer-specific wikis that compound in value with every document added**. The wiki becomes a living artifact — not a static dump.

---

## 2. Problem Statement

### Current Pain Points

1. **Scattered knowledge** — Customer documents live in email attachments, shared drives, Slack threads, and local folders. No single source of truth.
2. **Rediscovery on every question** — Teams re-read the same documents repeatedly because knowledge isn't synthesized and retained.
3. **Wiki abandonment** — Humans stop maintaining wikis because cross-referencing, summarizing, and keeping pages current is tedious and time-consuming.
4. **Single-customer focus** — Existing wiki tools are built for one team or one organization. Multi-customer management requires duplicating instances.
5. **Cloud dependency** — Many solutions require SaaS subscriptions, internet access, and vendor lock-in. Local/on-premise deployments are afterthoughts.

### Target Use Cases

| Domain | Example |
|--------|---------|
| **Customer success** | Aggregate all emails, meeting notes, contracts per customer into a wiki |
| **Consulting firms** | Build client knowledge bases from project docs, research, deliverables |
| **Legal / compliance** | Ingest contracts, regulations, case notes; flag contradictions across documents |
| **Support teams** | Wiki of product docs, past tickets, troubleshooting guides |
| **Sales** | Competitive intel, account histories, battle cards |
| **Personal knowledge** | Research deep-dives, book notes, learning journals |

---

## 3. Product Vision

> A local-first, AI-maintained, multi-customer wiki that grows smarter with every document you add — no cloud required.

### Design Principles

1. **Local-first** — Runs on your machine. All data is files you own (Markdown + JSON). No vendor lock-in.
2. **AI does the maintenance** — The LLM writes the wiki, updates cross-references, flags contradictions, and files answers. Humans curate sources and ask questions.
3. **Compounding knowledge** — Every ingested document enriches the wiki. Every answered question can be filed back. The wiki gets better over time.
4. **Multi-customer by default** — Scoped folders, isolated wikis, shared best-practices zone. No duplication of infrastructure.
5. **Container-native** — Single Podman container. One command to run. Easy to automate and deploy.

---

## 4. User Personas

### Persona 1: Knowledge Manager
- Uploads documents to customer workspaces
- Reviews AI-generated wiki pages
- Adjusts the shared schema to fit team conventions
- Triggers wiki health checks (lint)
- **Wants**: Confidence that AI-generated content is accurate and properly cross-linked

### Persona 2: Team Member / Analyst
- Browses wiki pages for a specific customer
- Asks natural-language questions and gets cited answers
- Files useful answers back into the wiki
- **Wants**: Fast, accurate answers without reading every document

### Persona 3: Administrator / Operator
- Creates and manages customer workspaces
- Monitors document processing pipelines
- Configures AI provider (OpenAI, Anthropic, Ollama)
- Manages the shared "How We Work" knowledge zone
- **Wants**: Simple setup, minimal maintenance, clear status visibility

---

## 5. Functional Requirements

### FR1 — Customer Workspace Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Create a new customer workspace with auto-initialized folder structure (`raw/`, `wiki/`, `index.md`, `log.md`, `config.json`) | P0 |
| FR1.2 | List all customer workspaces with name, creation date, document count, wiki page count | P0 |
| FR1.3 | Switch active customer context in the web dashboard | P0 |
| FR1.4 | Delete a customer workspace (with confirmation, irreversible) | P2 |
| FR1.5 | Each customer workspace is file-system-isolated under `/data/customers/{id}/` | P0 |

### FR2 — Document Upload & Storage

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Drag-and-drop file upload zone on customer dashboard | P0 |
| FR2.2 | Support file types: `.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, `.md` | P0 |
| FR2.3 | Display uploaded documents in a sortable/filterable list | P0 |
| FR2.4 | Each document stored with UUID filename in `raw/`, original name preserved in metadata sidecar JSON | P0 |
| FR2.5 | Show document metadata: filename, type, size, upload date, processing status | P0 |
| FR2.6 | Maximum file size: 50 MB per document (configurable) | P1 |
| FR2.7 | Prevent duplicate filenames (append counter or timestamp) | P2 |

### FR3 — Text Extraction

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | Extract plain text from PDF documents using `pdf-parse` | P0 |
| FR3.2 | Extract plain text from DOCX documents using `mammoth` | P0 |
| FR3.3 | Extract tabular data from XLSX/CSV as structured text | P1 |
| FR3.4 | Direct read for TXT and MD files | P0 |
| FR3.5 | Store extracted text in `extracted/` folder (`.txt` or `.json`) | P0 |
| FR3.6 | Show extraction status per document in UI | P1 |
| FR3.7 | Handle extraction errors gracefully — mark status as `failed`, log error | P1 |

### FR4 — AI Wiki Builder

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | On manual trigger ("Build Wiki" or "Process Document"), call LLM to generate/update wiki pages from extracted text | P0 |
| FR4.2 | LLM reads the shared schema/skill definition before processing | P0 |
| FR4.3 | LLM reads existing wiki `index.md` and relevant pages for context | P0 |
| FR4.4 | Generated wiki pages use Markdown with YAML frontmatter | P0 |
| FR4.5 | Generated wiki pages include `[[Wiki-Links]]` cross-references | P0 |
| FR4.6 | Generated wiki pages cite source documents using document IDs | P0 |
| FR4.7 | AI updates `index.md` after every processing run | P0 |
| FR4.8 | AI appends to `log.md` with timestamp, action, and summary | P0 |
| FR4.9 | AI flags contradictions between documents using ⚠️ markers | P1 |
| FR4.10 | Support multiple LLM providers: OpenAI, Anthropic, Ollama (local) | P1 |
| FR4.11 | Show processing progress in UI (e.g., "Identifying entities…", "Updating 3 pages…", "Done") | P2 |

### FR5 — Wiki Browsing & Search

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Browse wiki page list (from `index.md`) | P0 |
| FR5.2 | View rendered wiki page content (Markdown → HTML) | P0 |
| FR5.3 | Wiki-links are clickable and navigate to other pages | P0 |
| FR5.4 | Search wiki pages by title and content (client-side or simple backend search) | P1 |
| FR5.5 | View wiki page metadata: creation date, last updated, source count, tags | P2 |
| FR5.6 | Visual graph view of wiki page links (optional, D3.js / force-graph) | P3 |

### FR6 — Wiki Q&A

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | Ask a natural-language question against the customer's wiki | P0 |
| FR6.2 | AI searches wiki index, reads relevant pages, synthesizes answer | P0 |
| FR6.3 | Answer includes citations linked to specific wiki pages | P0 |
| FR6.4 | Optional: file useful answers back into the wiki as new pages | P1 |
| FR6.5 | Q&A chat history stored per customer session | P2 |

### FR7 — Workflow Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR7.1 | Track document processing status: `uploaded → extracting → extracted → processing → wiki_ready` | P0 |
| FR7.2 | Auto-trigger extraction on document upload (optional, configurable per customer) | P1 |
| FR7.3 | Auto-trigger wiki build after extraction (optional, configurable per customer) | P2 |
| FR7.4 | Manual retry on failed processing steps | P1 |
| FR7.5 | Visual status timeline per document in UI | P1 |

### FR8 — Shared Zone

| ID | Requirement | Priority |
|----|-------------|----------|
| FR8.1 | Shared "How We Work" folder accessible across all customers | P1 |
| FR8.2 | View and edit the AI skill/schema document (`schema.md`) via web UI | P1 |
| FR8.3 | View global activity log across all customers | P2 |
| FR8.4 | Shared zone contains best practices, templates, and conventions | P2 |

### FR9 — Lint & Health Check

| ID | Requirement | Priority |
|----|-------------|----------|
| FR9.1 | Trigger AI health check on a customer wiki | P2 |
| FR9.2 | AI identifies: contradictions between pages, orphan pages, stale claims, missing cross-references, content gaps | P2 |
| FR9.3 | Lint results displayed as a report with actionable items | P2 |

---

## 6. Non-Functional Requirements

| ID | Requirement | Detail |
|----|-------------|--------|
| NFR1 | **Local deployment** | Runs on a single machine via Podman. No external services required (except LLM API optionally). |
| NFR2 | **Container isolation** | All app logic and data live inside one Podman container. Persistent data on mounted volume. |
| NFR3 | **File-based storage** | No database dependency. All data stored as Markdown (`.md`) and JSON (`.json`) files on the filesystem. |
| NFR4 | **Performance** | Page loads < 500ms. AI processing time depends on document size and LLM provider — not a hard requirement. |
| NFR5 | **Scalability** | Target: up to 50 customers, 1,000 documents per customer, 500 wiki pages per customer. File-system bottleneck acceptable within this range. |
| NFR6 | **Portability** | App + data is a single Podman image + a `/data` directory. Can be moved between machines by copying the data directory. |
| NFR7 | **No authentication (v1)** | Single-user / internal-use only. Authentication is deferred to a future version. |
| NFR8 | **Graceful degradation** | If LLM is unavailable, document extraction and browsing still work. AI features show "unavailable" state. |
| NFR9 | **Error handling** | All file operations wrapped in try/catch. Failed extractions logged. AI failures retry once before marking failed. |
| NFR10 | **Data portability** | Wiki is human-readable Markdown. Customer can export their entire wiki by copying the folder. |

---

## 7. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       Podman Container                           │
│                                                                  │
│  ┌────────────────┐   HTTP    ┌──────────────────────────────┐  │
│  │   Web UI       │◄─────────►│   Express.js Backend (3000)   │  │
│  │   (Dynamic     │           │                              │  │
│  │    Frontend)   │           │  ┌────────────────────────┐  │  │
│  └────────────────┘           │  │   REST API Routes       │  │  │
│                               │  │   /api/customers/*      │  │  │
│                               │  │   /api/documents/*      │  │  │
│                               │  │   /api/wiki/*           │  │  │
│                               │  │   /api/ai/*             │  │  │
│                               │  │   /api/shared/*         │  │  │
│                               │  │   /api/workflows/*      │  │  │
│                               │  └────────────────────────┘  │  │
│                               │           │                  │  │
│                               │  ┌────────┴────────────────┐ │  │
│                               │  │   Service Layer          │ │  │
│                               │  │                          │ │  │
│                               │  │  ┌────────────────────┐ │ │  │
│                               │  │  │ Document Processor  │ │ │  │
│                               │  │  │ (PDF/DOCX/XLSX)    │ │ │  │
│                               │  │  └────────────────────┘ │ │  │
│                               │  │  ┌────────────────────┐ │ │  │
│                               │  │  │ AI Wiki Builder    │ │ │  │
│                               │  │  │ (LLM Client +      │ │ │  │
│                               │  │  │  Prompt Templates) │ │ │  │
│                               │  │  └────────────────────┘ │ │  │
│                               │  │  ┌────────────────────┐ │ │  │
│                               │  │  │ Workflow Engine    │ │ │  │
│                               │  │  │ (State Machine)    │ │ │  │
│                               │  │  └────────────────────┘ │ │  │
│                               │  │  ┌────────────────────┐ │ │  │
│                               │  │  │ File Store         │ │ │  │
│                               │  │  │ (FS Abstraction)   │ │ │  │
│                               │  │  └────────────────────┘ │ │  │
│                               │  └─────────────────────────┘ │  │
│                               │           │                  │  │
│                               └───────────┼──────────────────┘  │
│                                           │                      │
│                              ┌────────────┴───────────┐         │
│                              │   /data (Volume Mount)  │         │
│                              │                         │         │
│                              │  shared/                │         │
│                              │  ├── schema.md          │         │
│                              │  ├── index.md           │         │
│                              │  ├── log.md             │         │
│                              │  └── config.json        │         │
│                              │                         │         │
│                              │  customers/             │         │
│                              │  └── {id}/              │         │
│                              │      ├── config.json    │         │
│                              │      ├── index.md       │         │
│                              │      ├── log.md         │         │
│                              │      ├── raw/           │         │
│                              │      ├── extracted/     │         │
│                              │      └── wiki/          │         │
│                              └─────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
          ┌──────────────────┐         ┌──────────────────┐
          │   LLM Provider   │         │  Optional: Local │
          │ (OpenAI/Claude)  │         │  Ollama Server   │
          └──────────────────┘         └──────────────────┘
```

---

## 8. Data Model

### 8.1 Directory Layout

```
/data/
├── shared/
│   ├── schema.md          # AI skill/schema definition
│   ├── index.md           # Global index of shared content
│   ├── log.md             # Global activity log
│   └── config.json        # Global settings
│
└── customers/
    └── {customer-id}/
        ├── config.json    # Customer metadata
        ├── index.md       # Wiki page catalog
        ├── log.md         # Chronological activity log
        ├── raw/           # Immutable uploaded documents
        │   ├── {uuid}.pdf
        │   ├── {uuid}.docx
        │   ├── {uuid}.json     # Metadata sidecar
        │   └── ...
        ├── extracted/     # Extracted plain text
        │   ├── {uuid}.txt
        │   └── ...
        └── wiki/          # AI-generated markdown pages
            ├── Overview.md
            ├── {Entity}.md
            ├── {Concept}.md
            └── ...
```

### 8.2 Customer Config (`config.json`)

```json
{
  "id": "acme-corp",
  "name": "Acme Corporation",
  "createdAt": "2026-06-02T10:00:00Z",
  "updatedAt": "2026-06-02T10:00:00Z",
  "settings": {
    "autoExtract": true,
    "autoBuildWiki": false,
    "aiModel": "gpt-4o",
    "maxFileSizeMB": 50
  }
}
```

### 8.3 Document Metadata Sidecar (`{uuid}.json`)

```json
{
  "id": "a1b2c3d4-...",
  "originalName": "Contract-v2.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245760,
  "uploadedAt": "2026-06-02T11:00:00Z",
  "status": "wiki_ready",
  "extractedTextPath": "../extracted/a1b2c3d4.txt",
  "wikiPagesUpdated": [
    "wiki/Contracts.md",
    "wiki/Vendor-Agreements.md",
    "wiki/Payment-Terms.md"
  ],
  "workflowHistory": [
    { "event": "uploaded",     "at": "2026-06-02T11:00:00Z" },
    { "event": "extracting",   "at": "2026-06-02T11:00:01Z" },
    { "event": "extracted",    "at": "2026-06-02T11:00:05Z" },
    { "event": "processing",   "at": "2026-06-02T11:01:00Z" },
    { "event": "wiki_updated", "at": "2026-06-02T11:02:30Z" }
  ],
  "error": null
}
```

### 8.4 Wiki Page Format

```markdown
---
title: "Vendor Agreements"
category: "legal"
type: "synthesis"
sources:
  - a1b2c3d4
  - e5f6g7h8
tags:
  - contracts
  - vendors
  - legal
createdAt: "2026-06-02"
lastUpdated: "2026-06-02"
confidence: "high"
hasContradictions: false
---

# Vendor Agreements

## Summary
All active vendor agreements for Acme Corporation are...

## Key Points
- Payment terms are Net 30 across all agreements. See [[Payment-Terms]]
- Primary supplier: [[Acme-Supply-Co]]
- Contract renewal dates tracked in [[Contract-Renewal-Calendar]]

## Related Documents
- [Contract v2](../raw/a1b2c3d4.pdf)
- [Supplier Assessment Q1](../raw/e5f6g7h8.xlsx)

## Contradictions
_None flagged._
```

### 8.5 Index Page Format (`index.md`)

```markdown
# Wiki Index — Acme Corporation

## Entities
- [[Acme-Supply-Co]] — Primary supply vendor, Net 30 terms
- [[Vendor-Beta-Ltd]] — Secondary logistics provider

## Concepts
- [[Payment-Terms]] — Standard payment schedules across agreements
- [[Contract-Renewal-Calendar]] — Dates and lead times

## Source Summaries
- [[src-a1b2c3d4]] — Contract v2: Key terms and obligations
- [[src-e5f6g7h8]] — Supplier Assessment Q1 2026

## Synthesis
- [[Vendor-Agreements]] — Overall vendor relationship landscape
- [[Spend-Analysis-2026]] — Year-to-date procurement spending
```

### 8.6 Activity Log Format (`log.md`)

```markdown
# Activity Log — Acme Corporation

## [2026-06-02 11:00] upload | Contract-v2.pdf
Uploaded document: Contract-v2.pdf (PDF, 240 KB)
Status: queued for processing

## [2026-06-02 11:01] extract | Contract-v2.pdf
Text extraction completed. 45 paragraphs, 12 tables detected.

## [2026-06-02 11:02] wiki-update | Contract-v2.pdf
Updated pages: Contracts.md, Vendor-Agreements.md, Payment-Terms.md
Created pages: Contract-v2-Summary.md
Cross-links added: 7
```

### 8.7 Shared Schema (`schema.md`)

```markdown
# CXbox Wiki Schema

## Role
You are a wiki maintainer. You read source documents and update
the customer's wiki with accuracy and precision.

## Directory Structure
- `raw/` — Immutable source documents. Read only. Never modify.
- `wiki/` — Your generated markdown pages. You own this layer.
- `index.md` — Catalog of all wiki pages. Keep current.
- `log.md` — Append-only activity record.

## Page Types
- **entity** — People, companies, products, locations
- **concept** — Ideas, processes, policies, terms
- **source-summary** — One page per ingested document
- **synthesis** — Cross-cutting analysis pulling from multiple sources

## Conventions
- Every page MUST have YAML frontmatter with: title, type, sources, tags
- Use `[[Wiki-Links]]` for all cross-references
- Cite documents using their ID: `[^src-a1b2c3d4]`
- Flag contradictions with ⚠️ at the start of the paragraph
- Never modify files in `raw/` or `extracted/`

## Ingest Workflow
1. Read the extracted text file
2. Identify: entities, concepts, claims, dates, numbers
3. Search existing wiki for related pages (use index.md)
4. For each finding: either update an existing page or create new
5. Add `[[Wiki-Links]]` to connect new content to existing pages
6. Add source citations
7. Add/update YAML frontmatter
8. Update `index.md` with new/changed pages
9. Append to `log.md` with timestamp and summary
10. Return a summary of changes made

## Query Workflow
1. Read `index.md` to find the most relevant pages
2. Read full content of those pages
3. Synthesize an answer using only information from the wiki
4. Cite specific pages inline: [[Page-Name]]
5. If the wiki lacks information to answer, state so clearly
6. Suggest what new sources might fill the gap
```

---

## 9. API Design

### 9.1 Base URL & Conventions

```
Base: http://localhost:3000/api
Content-Type: application/json
Encoding: UTF-8
Errors: { "error": { "code": "NOT_FOUND", "message": "..." } }
```

### 9.2 Customer Endpoints

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `GET` | `/customers` | — | `[{ id, name, createdAt, docCount, wikiPageCount }]` | List all customers |
| `POST` | `/customers` | `{ "id": "acme", "name": "Acme Corp" }` | `{ customer }` | Create customer + folders |
| `GET` | `/customers/:id` | — | `{ customer }` | Get customer config |
| `PUT` | `/customers/:id` | `{ "name", "settings" }` | `{ customer }` | Update customer |

### 9.3 Document Endpoints

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `GET` | `/customers/:id/documents` | — | `[{ id, originalName, mimeType, sizeBytes, status, uploadedAt }]` | List documents |
| `POST` | `/customers/:id/documents` | `multipart/form-data` (file) | `{ document }` | Upload document |
| `GET` | `/customers/:id/documents/:docId` | — | `{ document }` | Get document + metadata |
| `DELETE` | `/customers/:id/documents/:docId` | — | `{ success }` | Delete document + metadata |

### 9.4 Processing Endpoints

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `POST` | `/customers/:id/documents/:docId/extract` | — | `{ status, extractedText }` | Trigger text extraction |
| `POST` | `/customers/:id/documents/:docId/build-wiki` | — | `{ changes: { created, updated, crossLinks } }` | Trigger AI wiki build |
| `POST` | `/customers/:id/documents/:docId/process` | — | `{ status }` | Full pipeline: extract → build |

### 9.5 Wiki Endpoints

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `GET` | `/customers/:id/wiki` | — | `{ index, pages[] }` | Get wiki index + page list |
| `GET` | `/customers/:id/wiki/*` | — | `{ page }` (markdown + frontmatter) | Get wiki page by path |
| `POST` | `/customers/:id/wiki/query` | `{ "question": "..." }` | `{ answer, citations[] }` | Ask question against wiki |
| `POST` | `/customers/:id/wiki/lint` | — | `{ report: { contradictions[], orphans[], gaps[] } }` | Trigger health check |
| `GET` | `/customers/:id/wiki/search` | `?q=term` | `{ results[] }` | Search wiki pages |

### 9.6 Shared Zone Endpoints

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `GET` | `/shared` | — | `{ schema, index, log, config }` | Get shared zone content |
| `PUT` | `/shared/schema` | `{ "content": "..." }` | `{ success }` | Update schema/skill |
| `PUT` | `/shared/config` | `{ "settings" }` | `{ config }` | Update global settings |

---

## 10. UI/UX Requirements

### 10.1 Layout — Dashboard Shell

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]  CXbox — Customer Wiki Manager                       │
│                                                             │
│ Customer: [acme-corp ▼]  |  Docs: 23  |  Wiki Pages: 47    │
│─────────────────────────────────────────────────────────────│
│  [Upload]  [Documents]  [Wiki]  [Q&A]  [Health]  [Shared]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Active Panel                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Status Bar: AI: Connected (gpt-4o) | Last ingest: 2m ago  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Screens

#### A) Upload Panel
- Large drop zone with file type icons
- Drag-and-drop support
- Click to browse files
- Upload progress bar
- Recent uploads list below

#### B) Documents Panel  
- Table with columns: Name, Type, Size, Status, Upload Date, Actions
- Status badges: 🟡 Uploaded, 🔵 Extracting, 🟢 Extracted, 🟣 Processing, ✅ Wiki Ready, ❌ Failed
- Action buttons: Extract, Build Wiki, View Extracted Text, Delete
- Filter by status, type

#### C) Wiki Browser
- Left sidebar: Page tree (from index.md, grouped by category)
- Main area: Rendered markdown page
- Clickable `[[Wiki-Links]]`
- Page metadata header (title, type, sources, tags, last updated)
- "Edit Page" button (v2)

#### D) Q&A Panel
- Chat-like interface
- Text input + "Ask" button
- Answer appears with markdown rendering
- Inline citations like [[page-name]] that link to wiki pages
- "File this answer to wiki" button under each answer
- Collapsible chat history

#### E) Health Check Panel
- "Run Lint" button
- Results in categorized list:
  - ⚠️ Contradictions (2)
  - 🔗 Orphan pages (5)
  - 📝 Missing cross-references (3)
  - 🔍 Content gaps (1)
- Each item expandable with details
- "Fix suggestions" from AI

#### F) Shared Zone Panel
- Markdown editor for `schema.md`
- Preview toggle
- "Save Schema" button
- Read-only views of shared `index.md` and `log.md`

### 10.3 UX Principles
- **Responsive** — Works on desktop and tablet
- **Dark mode** support (respects system preference)
- **No page reloads** — Dynamic panel switching
- **Optimistic UI** — Show actions immediately, confirm after API response
- **Toast notifications** — Success/error feedback, auto-dismiss

---

## 11. AI Integration Requirements

### 11.1 LLM Provider Abstraction

The system SHALL support multiple LLM providers through a unified interface:

| Provider | Configuration | Notes |
|----------|--------------|-------|
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o`) | Recommended for accuracy |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`) | Good for structured output |
| Ollama | `OLLAMA_HOST` (default: `http://localhost:11434`), `OLLAMA_MODEL` (default: `llama3`) | Fully local, no API key needed |

### 11.2 Prompt Management

- All prompts stored as `.txt` files under `src/ai/prompts/` — editable without code changes
- Prompts include placeholders: `{{SKILL}}`, `{{EXTRACTED_TEXT}}`, `{{WIKI_CONTEXT}}`, `{{QUESTION}}`, `{{INDEX}}`
- Prompt versioning: each prompt file has a version comment header
- Token budget: max context per call configurable (default: 128K for GPT-4o, 200K for Claude)

### 11.3 AI Operations

| Operation | Prompt File | Input Context | Expected Output |
|-----------|------------|---------------|-----------------|
| **Ingest** | `ingest.txt` | Skill + extracted text + existing wiki pages + index | New/updated markdown pages, index update, log entry |
| **Query** | `query.txt` | Skill + question + index + relevant wiki pages | Answer text with citations |
| **Lint** | `lint.txt` | Skill + full index + all wiki page titles + some content | Contradictions, orphans, gaps report |

### 11.4 AI Output Parsing

The LLM response SHALL conform to a structured format to enable reliable parsing:

```
<!-- WIKI_PAGE: path/to/page.md -->
(full page content with frontmatter)
<!-- END_WIKI_PAGE -->

<!-- INDEX_UPDATE -->
(updated index entries)
<!-- END_INDEX_UPDATE -->

<!-- LOG_ENTRY -->
### [date] action | summary
(details)
<!-- END_LOG_ENTRY -->

<!-- SUMMARY -->
- Created: 2 pages
- Updated: 3 pages
- Cross-links added: 7
<!-- END_SUMMARY -->
```

### 11.5 Error Handling

- LLM timeout: 120 seconds (configurable)
- Retry on transient errors: 1 retry with exponential backoff
- If LLM returns malformed output, log raw response and mark processing as `failed`
- Show partial results if some pages were generated successfully
- Never overwrite wiki pages unless the new version passes basic validation (has frontmatter, has title, has at least one section)

---

## 12. Workflow Engine Requirements

### 12.1 Document Lifecycle States

```
  uploaded ──► extracting ──► extracted ──► processing ──► wiki_ready
                  │               │              │
                  ▼               ▼              ▼
               failed          failed         failed
```

### 12.2 State Machine Rules

| From | To | Trigger | Condition |
|------|----|---------|-----------|
| — (new upload) | `uploaded` | File saved to `raw/` | Always |
| `uploaded` | `extracting` | Manual trigger OR `autoExtract: true` | File type supported |
| `extracting` | `extracted` | Extraction completes | No error |
| `extracting` | `failed` | Extraction error | — |
| `extracted` | `processing` | Manual "Build Wiki" trigger OR `autoBuildWiki: true` | LLM available |
| `processing` | `wiki_ready` | AI wiki update completes | No error |
| `processing` | `failed` | AI error or timeout | — |
| Any failed state | Previous step | Manual "Retry" trigger | — |

### 12.3 Workflow Configuration (per customer)

```json
{
  "workflow": {
    "autoExtract": true,
    "autoBuildWiki": false,
    "maxRetries": 1,
    "notifyOnComplete": false
  }
}
```

### 12.4 Workflow History

Every state transition is recorded in the document's metadata sidecar with:
- `event` — The state name
- `at` — ISO 8601 timestamp
- Optional `error` — Error message if transition was to `failed`

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Running container with basic web server, customer CRUD, folder initialization.

**Tasks**:
1. Initialize Node.js 22 project with `package.json` and Express
2. Create project directory structure (`src/`, `public/`, `src/routes/`, `src/services/`)
3. Implement `fileStore.js` — file system abstraction layer
4. Implement customer creation with auto-initialized folder structure
5. Create shared zone initialization (`/data/shared/`)
6. Create `Containerfile` for Podman
7. Build static frontend shell with customer selector
8. Implement `GET/POST /api/customers` endpoints

**Deliverables**:
- `podman build -t cxbox . && podman run -p 3000:3000 -v ./data:/data cxbox`
- Web UI loads at `http://localhost:3000`
- Can create a customer, folders appear in `/data/customers/{id}/`

---

### Phase 2: Document Upload & Storage (Week 1-2)

**Goal**: Upload files to customer raw/ folders with metadata tracking.

**Tasks**:
1. Add `multer` for multipart file uploads
2. Implement `POST /customers/:id/documents` — UUID naming, store in `raw/`
3. Create metadata sidecar JSON for each document
4. Implement document list endpoint with status, type, size
5. Frontend: Drop zone component with drag-and-drop
6. Frontend: Document table with status badges
7. Add `GET /customers/:id/documents/:id`, `DELETE` endpoints

**Deliverables**:
- Upload PDF, DOCX, XLSX, CSV, TXT, MD via drag-and-drop UI
- Files stored in correct customer folder with metadata
- Document list shows all uploaded documents with status

---

### Phase 3: Text Extraction (Week 2)

**Goal**: Extract text from all supported formats.

**Tasks**:
1. Add extraction libraries: `pdf-parse`, `mammoth`, `xlsx`, `csv-parse`
2. Implement `documentProcessor.js` with format-specific extractors
3. Add `POST /customers/:id/documents/:id/extract` endpoint
4. Store extracted text in `extracted/{uuid}.txt`
5. Update document status through workflow states
6. Frontend: Extraction status indicator, "View Extracted Text" button

**Deliverables**:
- Upload any supported file type → click "Extract" → text appears
- Extraction errors handled gracefully with error display

---

### Phase 4: AI Wiki Builder (Week 2-3)

**Goal**: AI processes extracted text into structured wiki pages.

**Tasks**:
1. Write the initial `schema.md` (shared skill definition)
2. Create prompt templates: `ingest.txt`, `query.txt`, `lint.txt`
3. Implement `llmClient.js` — abstraction over OpenAI, Anthropic, Ollama
4. Implement `wikiBuilder.js` — orchestrates the ingest workflow:
   - Read schema + extracted text + existing wiki
   - Call LLM with `ingest.txt`
   - Parse structured output (pages, index updates, log entries)
   - Write files to `wiki/`, update `index.md`, append `log.md`
5. Add `POST /customers/:id/documents/:id/build-wiki` endpoint
6. Add `POST /customers/:id/documents/:id/process` (full pipeline)
7. Frontend: "Build Wiki" button, processing status spinner

**Deliverables**:
- Upload a document → extract text → click "Build Wiki" → AI generates structured wiki pages with frontmatter, `[[links]]`, and source citations
- Index and log auto-updated
- Multi-page updates work (one document can touch 5+ wiki pages)

---

### Phase 5: Wiki Browsing & Q&A (Week 3)

**Goal**: Browse wiki and ask natural-language questions.

**Tasks**:
1. Implement wiki page list endpoint (parse `index.md`)
2. Implement wiki page content endpoint (read + parse frontmatter)
3. Implement simple wiki search (read all pages, grep content)
4. Implement `wikiQuery.js`:
   - Parse index to find relevant pages
   - Read page contents
   - Call LLM with question + context
   - Return cited answer
5. Add `POST /customers/:id/wiki/query` endpoint
6. Frontend: Wiki browser with sidebar tree + page viewer
7. Frontend: Q&A chat panel with citations
8. Add markdown rendering (use `marked`) for wiki pages and answers

**Deliverables**:
- Browse wiki pages with rendered markdown and clickable links
- Type a question → get AI answer with wiki citations linked to pages
- "File answer to wiki" feature

---

### Phase 6: Workflows & Automation (Week 3-4)

**Goal**: Auto-extract and optional auto-build workflow.

**Tasks**:
1. Implement `workflowEngine.js` state machine
2. Auto-trigger extraction on upload (when `autoExtract: true`)
3. Auto-trigger wiki build after extraction (when `autoBuildWiki: true`)
4. Manual retry on failed steps
5. Frontend: Workflow timeline component (stepper/timeline UX)
6. Frontend: Auto-processing toggle per customer

**Deliverables**:
- Upload → auto-extract (if enabled) → status updates visible
- Retry failed steps from UI
- Workflow history visible per document

---

### Phase 7: Shared Zone, Lint & Polish (Week 4)

**Goal**: Complete shared zone, add lint, polish UI.

**Tasks**:
1. Implement shared zone API (read/write schema, config)
2. Implement lint endpoint: reads wiki, calls LLM, returns report
3. Frontend: Schema editor with live preview
4. Frontend: Lint report panel
5. Frontend: Customer switcher UX
6. Dark mode support
7. Responsive design pass
8. README and setup documentation

**Deliverables**:
- Edit shared schema via web UI
- Run lint → see contradictions, orphans, gaps
- Full UI polish

---

## 14. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LLM hallucination in wiki pages** | Medium | High | Require source citations; human review flow; confidence scoring; contradiction flags |
| **Large documents exceed LLM context** | Medium | Medium | Chunk large documents; summarize chunks; progressive ingestion |
| **LLM API costs at scale** | Low | Medium | Support local Ollama; batch processing; manual-trigger by default |
| **Concurrent file writes corrupt wiki** | Low | High | Simple file locking; process one document at a time per customer (Phase 1) |
| **Conflicting LLM output format** | Medium | Medium | Structured output markers; fail gracefully; log raw output for debugging |
| **No OCR — image-only PDFs unusable** | Medium | Low | Document limitation clearly stated; OCR on roadmap for v2 |
| **Node.js 22 compatibility with all packages** | Low | Low | Verify all packages support Node 22 before Phase 1; fallback to Node 20 |
| **File system performance at scale** | Low | Low | Target < 1,000 docs per customer; plan SQLite migration if needed |
| **Git merge conflicts in data files** | Low | Low | Data is single-user for v1; future multi-user would need conflict resolution |

---

## 15. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 22 (Active LTS) | Server runtime, stable until April 2027 |
| **Framework** | Express.js 4.x | HTTP server, routing, middleware |
| **Frontend** | Vue 3 (Composition API) + Vite 6.x | Reactive SPA framework, fast dev/build |
| **Frontend CSS** | Vue-scoped styles + CSS custom properties | Component-scoped styling, theme variables |
| **Markdown Rendering** | `marked` 12.x | Client-side + server-side markdown → HTML |
| **Frontmatter Parsing** | `gray-matter` 4.x | YAML frontmatter extraction |
| **File Upload** | `multer` 1.x | Multipart form parsing |
| **PDF Extraction** | `pdf-parse` 1.x | Text extraction from PDF |
| **DOCX Extraction** | `mammoth` 1.x | Text extraction from Word |
| **Excel Extraction** | `xlsx` 0.x | Text extraction from spreadsheets |
| **CSV Extraction** | `csv-parse` 5.x | Text extraction from CSVs |
| **LLM — Primary** | GitHub Copilot API | Primary AI provider for wiki generation and Q&A |
| **LLM — Fallback** | Ollama (native `fetch()`) | Local fallback when Copilot API unavailable |
| **Container** | Podman 5.x | Rootless container runtime |
| **Base Image** | `node:22-alpine` | Small attack surface, fast builds |

---

## 16. Open Questions

| # | Question | Status |
|---|----------|--------|
| Q1 | Frontend: htmx + vanilla JS, or Alpine.js, or React/Vue/Svelte? | **✅ Vue 3 (with Vite)** |
| Q2 | Default LLM provider: OpenAI, Anthropic, or Ollama? | **✅ GitHub Copilot API** |
| Q3 | Do you have API keys for cloud LLM providers, or should we default to local Ollama? | **✅ GitHub Copilot API + fallback to local (Ollama)** |
| Q4 | Authentication: deferred to post-v1 or needed from day one? | **Deferred** |
| Q5 | Wiki graph view: D3.js force-graph for v1 or defer to v2? | **Deferred to v2** |
| Q6 | Webhook/email notifications on workflow completion? | **Deferred to v2** |
| Q7 | OCR (Tesseract.js) for image-based PDFs — roadmap item? | **Deferred to v2** |
| Q8 | Should the AI also generate Dataview-compatible pages (Obsidian plugin compatibility)? | **Nice to have** |
| Q9 | Multi-user/collaboration: in scope for v1 roadmap? | **Deferred to v2** |

---

## 17. Appendix

### A. Karpathy's LLM-Wiki Pattern (Reference)

This product is directly inspired by Andrej Karpathy's [LLM-Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The core architecture is:

> 1. **Raw sources** — Your curated collection of immutable source documents
> 2. **The wiki** — A directory of LLM-generated markdown files that the AI owns entirely
> 3. **The schema** — A document that tells the LLM how the wiki is structured

Operations: **Ingest** (process documents into wiki), **Query** (ask questions), **Lint** (health-check the wiki).

Key insight: **The wiki is a persistent, compounding artifact** — not a one-off RAG lookup. Knowledge is compiled once and kept current, not re-derived on every query.

### B. Glossary

| Term | Definition |
|------|------------|
| **Raw** | Original, immutable uploaded documents. Source of truth. |
| **Extracted** | Plain text extracted from raw documents for LLM consumption. |
| **Wiki** | AI-generated, interlinked markdown pages — the knowledge layer. |
| **Schema** | The skill definition that teaches the AI how to be a wiki maintainer. |
| **Ingest** | The full pipeline: upload → extract → AI wiki build. |
| **Lint** | AI health check of the wiki for contradictions, orphans, gaps. |
| **Index** | `index.md` — a catalog of all wiki pages with summaries. |
| **Log** | `log.md` — a chronological append-only activity record. |
| **Shared Zone** | Global knowledge about how to run wiki operations — schema, best practices. |
| **Customer Workspace** | Scoped folder under `/data/customers/{id}/` for one customer's documents and wiki. |

### C. Document Status Lifecycle Diagram

```
                  ┌─────────┐
                  │uploaded │ ◄── File saved to raw/
                  └────┬────┘
                       │ [autoExtract or manual trigger]
                       ▼
                  ┌──────────┐
            ┌────►│extracting│
            │     └────┬─────┘
            │          │ [complete]         [error]
            │          ▼                    ▼
            │     ┌─────────┐         ┌────────┐
            │     │extracted│         │ failed │◄── Retry button
            │     └────┬────┘         └────────┘
            │          │ [autoBuildWiki or manual]
            │          ▼
            │     ┌──────────┐
            │     │processing│
            │     └────┬─────┘
            │          │ [complete]         [error]
            │          ▼                    ▼
            │     ┌──────────┐        ┌────────┐
            └─────│wiki_ready│        │ failed │◄── Retry button
                  └──────────┘        └────────┘
```

---

**End of PRD**
