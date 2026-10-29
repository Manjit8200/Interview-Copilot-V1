# Interview Copilot — Full-stack MVP

A runnable single-user, local-first interview preparation web application. Upload a PDF/DOCX/TXT resume, provide company and role details, save sessions in SQLite, generate AI answers based on actual experience, and revisit answer history.

## Requirements
- Node.js 20.9+ (Node.js 22 LTS recommended)
- npm
- OpenAI API key (for answer generation)

## Setup
```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```
Visit **http://localhost:3000**. Edit `.env` with `OPENAI_API_KEY=...` and restart the dev server to use answer generation. Never put an API key into a browser or commit `.env`.

## MVP Features
- Resume text extraction: PDF, DOCX, TXT (5 MB limit; scanned PDFs are not supported)
- Interview session form: company, role, job description, optional title
- SQLite persistence through Prisma, answers history and delete
- AI answers: natural, concise, STAR, technical; grounded in resume
- Responsive dashboard

## Architecture
`Next.js App Router + React + TypeScript` → `Route Handlers /api/*` → `Prisma + SQLite` and `OpenAI Responses API`.

## API
- `POST /api/upload` multipart `file`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `POST /api/answers` (`sessionId`, `question`, `style`)

## Important security and deployment notes
**This is a local, single-user development MVP, not a public multi-user service.** It has no authentication, authorization, rate limiting, encrypted stored resumes, or data retention controls. Do not deploy it publicly or upload sensitive resumes until these are added. For multi-user production: add authenticated users and tenant-scoped queries, PostgreSQL, object storage with private access, consent and privacy controls, abuse protection, deletion/export, observability, and cost controls. Local SQLite is not suitable for ephemeral Vercel filesystem hosting.

## Live interviews roadmap
The current version supports typed questions, not live audio. Next add consent-aware microphone transcription, supported meeting integrations, streaming, latency monitoring, and clear disclosure/assistance policies.

## Quality status
Source project packaged for local installation. Dependency installation and real API calls were not executed in the packaging environment.

## Phase 2: Live microphone + streamed AI answer suggestions

The **Live interview assistant (Beta)** panel in each interview session supports:

- Microphone speech recognition using the browser Web Speech API, including interim and final transcript updates.
- Editable transcript, manual start/stop, explicit **Suggest answer** action, and cancel.
- Server-side OpenAI Responses API streaming via `/api/answers/stream` using SSE; the API key never reaches the browser.
- Incremental display of answer text and automatic save to the existing Prisma `Answer` table after successful completion.
- The existing typed question workflow remains available.

**Browser and consent limitations:** SpeechRecognition is not universally supported. Desktop Chrome is a reasonable starting point. Some browsers send microphone audio to third-party speech services. Microphone capture does not directly capture the remote speaker's audio in a Zoom, Teams, or Meet call. The app does not silently record, automatically submit questions, or bypass meeting permissions. Use only when interviewing parties consent and interview rules permit assistance.

**Costs:** Browser speech recognition isn't billed to your OpenAI API account under this implementation. Each streamed AI answer consumes OpenAI API tokens and uses the model configured in `.env`. Stop generation to avoid unnecessary requests. Do not publish without authentication, request throttling, and spending caps.

## Update: Separate answers and transcript reset
- Clicking **Suggest answer** captures the current question, stops recognition, clears the transcript, and starts a clean streaming answer. Click **Start listening** for the next question.
- After a successful stream, the response is saved to **Interview Answer History**, newest first; the live answer display clears.
- Both the streamed and typed-answer routes now use a direct, varied, conversational interview-coach prompt that avoids repetitive "In my experience" openers.
- Note: speech recognition may still deliver late results when stopping. Recognition is deliberately not restarted automatically; review the next transcript before suggesting an answer.


## Phase 2.4: Live-only interview layout

The manual Answer Studio panel has been removed. The session screen shows the Live Interview Assistant, followed by Interview Answer History. Answers use the Natural style by default. Continuous microphone behavior from Phase 2.3 is retained.


## Phase 2 repair notes
- Latest answer stays visible after generation and answer history is refreshed from the database.
- Streaming now checks for a complete saved response; missing or failed responses show an actionable error.
- Answer Studio remains removed. Start Listening once, then click Suggest Answer for each question; listening resumes when a response finishes.
- **To recover history:** Before replacing your old project, copy `prisma/dev.db` from the old project to the same location in this new project, with the dev server stopped. Keep your original `.env` too. This ZIP intentionally does not contain your private data.
- Back up your old folder before replacing it. Do not share `.env` or `dev.db` publicly.
# Interview-Copilot-V1
