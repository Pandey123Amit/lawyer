# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NyayMitra is an AI-powered legal document assistant for Indian lawyers. It has two core modes:
- **Create Mode**: Voice/text input → GPT-4o transcript + metadata extraction → legal document draft → DOCX/PDF export
- **Understand Mode**: PDF/image upload → OCR (Tesseract) or pdf-parse → GPT-4o structured explanation → export

## Tech Stack

- **Frontend**: React 18 + Vite 5, React Router 6, Axios, pure CSS with custom properties
- **Backend**: Express.js 4, raw SQL via `pg` (no ORM), JWT auth (bcryptjs + jsonwebtoken)
- **Database**: PostgreSQL 16 (UUID primary keys, JSONB metadata)
- **AI**: OpenAI GPT-4o (drafts, explanations, metadata extraction), Whisper (speech-to-text)
- **OCR**: Tesseract.js (Hindi + English)
- **Document Generation**: `docx` for DOCX, `pdfkit` for PDF

## Common Commands

```bash
# Backend
cd server
npm install
npm run migrate        # Run database schema migration (raw SQL)
npm run dev            # Start Express server on port 3001 (nodemon)
npm test               # Jest tests (server/tests/services.test.js)

# Frontend
cd client
npm install
npm run dev            # Vite dev server on port 3000 (proxies /api → :3001)
npm run build          # Production build

# Docker (PostgreSQL + server)
docker-compose up
```

### Environment Setup

Copy `server/.env.example` → `server/.env`. Required: `OPENAI_API_KEY`, `DATABASE_URL`, `JWT_SECRET`.

## Architecture

```
client/src/                          server/src/
├── App.jsx (routes + AuthProvider)  ├── index.js (Express entry)
├── hooks/                           ├── config/
│   ├── useAuth.jsx (AuthContext)    │   ├── database.js (pg pool)
│   └── useVoiceRecorder.jsx         │   └── migrate.js (schema SQL)
├── services/                        ├── middleware/
│   └── api.js (Axios + JWT)        │   ├── auth.js (JWT verify)
├── pages/                           │   └── upload.js (Multer configs)
│   ├── CreateModePage.jsx           ├── routes/
│   ├── UnderstandModePage.jsx       │   ├── auth.js, create.js
│   ├── HistoryPage.jsx             │   ├── understand.js, documents.js
│   └── LoginPage.jsx               ├── services/
└── components/                      │   ├── VoiceService.js (Whisper + extraction)
    ├── common/Header.jsx            │   ├── DraftService.js (GPT-4o drafting)
    ├── create-mode/                 │   ├── ExplanationService.js (OCR + explain)
    └── understand-mode/             │   └── DocumentService.js (DOCX/PDF gen)
                                     ├── prompts/draftPrompts.js
                                     └── utils/ (logger, disclaimer)
```

### Key Data Flow

**Create Mode**: `CreateModePage → VoiceService.transcribe() → VoiceService.extractMetadata() → DraftService.generateDraft() → DocumentService.generateDocx/Pdf()`

**Understand Mode**: `UnderstandModePage → ExplanationService.extractText() (pdf-parse or Tesseract OCR) → ExplanationService.explainDocument() → DocumentService export`

### Backend Pattern

Routes → Services (singleton instances) → Database (raw parameterized SQL via pg pool). No ORM. Services interact with OpenAI directly. AI prompts live in `server/src/prompts/`. All AI calls are logged to the `ai_logs` table with token usage and latency.

### Frontend Pattern

Function components + hooks only. Auth state via React Context (`useAuth`). Axios interceptors inject JWT and handle 401 → logout. Token/user stored in localStorage. Vite proxies `/api` to backend in dev.

### Database Tables

- `users` — accounts with role, plan, bar_council_id
- `documents` — stores mode (create/understand), transcript, ai_output, metadata (JSONB), status, 72h expiry
- `ai_logs` — prompt/response logging per AI call with model, tokens, latency
- `edits` — draft revision history (original vs edited text)

## Important Details

- Legal document types with specialized prompts: `rental_agreement`, `sale_deed`, `affidavit`, `legal_notice`, `power_of_attorney`, `will`, `partnership_deed`
- OpenAI temperature set to 0.1–0.3 for deterministic legal output
- File uploads: audio max 25MB, documents max 15MB (Multer)
- Bilingual disclaimers (English + Hindi) appended to all AI-generated documents
- Exported documents use court-ready formatting (Times New Roman, A4, proper margins)
- Passwords hashed with bcrypt cost factor 12; JWT expires in 7 days
- Rate limiting: 100 requests per 15 minutes
- Uploads stored locally in `server/uploads/` with UUID filenames
