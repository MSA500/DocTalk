# DocTalk — End-to-End Pipeline

This document describes the two core flows implemented in this codebase, exactly as they currently run in production: document upload/indexing, and voice question & answer. Every step names the exact file, route, or external service responsible for it. This is the written form of the project's architecture diagram deliverable.

---

## Flow 1: Document Upload & Indexing

### 1. User selects a file
**File:** `src/components/dashboard/CompactUploadBar.tsx` (drag-and-drop or "Browse files" button) or `src/components/dashboard/HiddenFileInput.tsx` (native file picker)
The user drags a file onto the upload card, or clicks "Browse files" to open the OS file picker. Accepted types are PDF, DOCX, or TXT, up to 15 MB.
**Hands off to:** the selected `File` object(s), passed to `handleFilesSelected` on `src/lib/hooks/useDocumentWorkspace.ts`.

### 2. Client-side validation
**File:** `src/lib/hooks/useDocumentWorkspace.ts` (`validateClientSide`, using `src/lib/document-type.ts` and `src/lib/documents/validate-upload.ts`'s `MAX_FILE_SIZE_BYTES`)
Rejects the file immediately (with a toast, no network call) if its extension/MIME type isn't PDF/DOCX/TXT, if it's empty, or if it exceeds 15 MB.
**Hands off to:** `uploadOne(file)`, which begins the two-phase direct-upload sequence.

### 3. Prepare the upload (metadata only, no file bytes)
**File:** `src/app/api/documents/prepare-upload/route.ts` (`POST /api/documents/prepare-upload`)
Receives only `{ filename, sizeBytes, mimeType }` as JSON — never the file itself, which is what keeps this request far under Vercel's serverless function body-size limit regardless of how large the actual file is. It re-validates type/size server-side (`src/lib/documents/validate-upload.ts`), inserts a new `documents` row at `status: "uploading"`, calls `createDocumentUploadUrl()` (`src/lib/documents/storage.ts`) to ask Supabase Storage for a short-lived signed upload URL via `createSignedUploadUrl()`, and saves the resulting `storage_path` on the row.
**Hands off to:** the client, with the new document's id and the signed upload URL.

### 4. Direct browser-to-Storage upload
**File:** `src/lib/hooks/useDocumentWorkspace.ts` (`putFileToSignedUrl`) → **Service:** Supabase Storage
The browser sends the raw file bytes directly to the signed URL via an `XMLHttpRequest` PUT, authenticated with the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This request goes straight to Supabase's infrastructure and never touches any Vercel serverless function, which is exactly what allows files up to the full 15 MB limit to upload reliably. `xhr.upload` progress events drive the visible upload progress bar (`src/components/dashboard/DocumentCard.tsx`).
**Hands off to:** `confirmUpload(documentId, success)`, once the PUT settles (success or failure).

### 5. Confirm the upload
**File:** `src/app/api/documents/[id]/confirm-upload/route.ts` (`POST /api/documents/[id]/confirm-upload`)
If the client reports the PUT failed, marks the document `failed` immediately. If the client reports success, it doesn't just trust that claim — it independently re-verifies the file actually exists in the bucket via `documentFileExists()` (`src/lib/documents/storage.ts`, a Storage `list()` call). Only once that's confirmed does it advance the document's status to `extracting`.
**Hands off to:** the client, which now starts calling the processing route in a loop.

### 6. Processing loop — one bounded step per call
**File:** `src/app/api/documents/[id]/process/route.ts` (`POST /api/documents/[id]/process`), driven by `src/lib/hooks/useDocumentWorkspace.ts` (`runProcessing`)
The client calls this endpoint repeatedly until it reports `done: true`. Each call does exactly one bounded unit of work via `processDocumentStep()` in `src/lib/documents/process-document.ts`, so a large document's total processing time is spread across many short-lived invocations instead of one long request that would risk timing out. The route infers which phase to run from the document's current `chunk_count` (zero = extraction hasn't happened yet; non-zero = only embeddings remain).

#### 6a. Extract phase (first call only)
**File:** `src/lib/documents/process-document.ts` (`runExtractPhase`)
Sets status to `extracting`, downloads the raw file from Supabase Storage (`downloadDocumentFile()` in `src/lib/documents/storage.ts`), and extracts plain text from it via `src/lib/documents/extract-text.ts` — using `unpdf` for PDF, `mammoth` for DOCX, or a direct UTF-8 read for TXT. The extracted text is split into overlapping chunks by `src/lib/documents/chunk-text.ts` (sentence-aware splitting, ~500 tokens per chunk with ~50 tokens of overlap). Every chunk's text is inserted into the `document_chunks` table in Supabase Postgres with `embedding = NULL` (concurrent batched inserts, so a large document's chunk rows land in the time of the slowest single insert, not the sum). The document's `chunk_count` is set and status becomes `embedding`.
**Hands off to:** the next call, which will run the embed phase since `chunk_count` is now non-zero.

#### 6b. Embed phase (repeated calls)
**File:** `src/lib/documents/process-document.ts` (`runEmbedPhase`)
Selects the next batch of chunks still missing an embedding (up to 96 rows, oldest `chunk_index` first). Gets the configured embedding provider via `getEmbeddingProvider()` (`src/lib/ai/embeddings.ts`), which for Hugging Face (`src/lib/ai/embeddings/huggingface.ts`) calls the **Hugging Face Inference API**'s feature-extraction endpoint in sub-batches of 32 texts at a time. Each returned vector is written back to its `document_chunks` row via `upsert()` as soon as that sub-batch completes, so partial progress survives an interruption. A 20-second wall-clock budget stops the loop from starting a new sub-batch once time is running low, so no single invocation risks exceeding the serverless time limit — the client's next call simply continues from whichever chunks are still `NULL`.
**Hands off to:** either another embed-phase call (if chunks remain unembedded) or the final "ready" step (if none do).

### 7. Mark ready
**File:** `src/lib/documents/process-document.ts` (`finalizeReady`)
Once every chunk for the document has a stored embedding, sets the document's status to `ready`. The `/process` response reports `done: true`, which stops the client's polling loop and shows the "Document ready" toast.
**Hands off to:** nothing further automatically — the document is now a fully indexed, searchable part of this session's document library, ready to be retrieved by Flow 2.

### 8. Live progress & resume, throughout
**Files:** `src/app/api/documents/route.ts` (`GET /api/documents`, list + per-document progress), `src/app/api/documents/[id]/route.ts` (`GET`/`DELETE` for a single document), `src/lib/documents/process-document.ts` (`getProcessingProgress`)
While a document is `embedding`, `getProcessingProgress()` computes `{ embedded, total }` by counting remaining `NULL`-embedding rows, which the dashboard's `DocumentCard.tsx` renders as a determinate percentage. If a browser tab is closed and reopened mid-processing, `useDocumentWorkspace.ts`'s load effect detects any document still in `extracting`/`embedding` on page load and automatically resumes calling `/process` for it; a document still stuck at `uploading` past a 3-minute grace period (no confirmed file to resume from) is instead cleanly marked `failed` via `confirm-upload` rather than retried indefinitely.

### 9. Storage layer
**Service:** Supabase (Postgres + pgvector + Storage)
Underlying every step above: the `documents` and `document_chunks` tables (`supabase/migrations/0001_init.sql`, `0002_granular_processing_stages.sql`), a `documents` Storage bucket capped at 15 MB via `file_size_limit` (`supabase/migrations/0004_direct_upload_bucket_size_limit.sql`, enforced at the Storage layer itself as defense-in-depth against a client that lies about size in step 3), and an HNSW index on `document_chunks.embedding` for fast similarity search (used by Flow 2).

---

## Flow 2: Voice Question & Answer

### 1. User presses the mic button
**File:** `src/components/voice/VoiceHeroPanel.tsx` (renders the mic button, opens `src/components/voice/VoiceCallOverlay.tsx`), which mounts `src/lib/hooks/useVoiceCall.ts`
Pressing the mic button opens the fullscreen call overlay and initializes the voice call hook.

### 2. Check configuration / demo-mode fallback
**File:** `src/app/api/config/status/route.ts` (`GET /api/config/status`), read by `src/lib/hooks/useVoiceCall.ts`
Reports whether Supabase, the embedding provider, the LLM provider, and Vapi (`VAPI_PUBLIC_KEY` + `VAPI_ASSISTANT_ID`) are all fully configured (`src/lib/config-status.ts`). If any piece is missing, the client falls back to a canned demo conversation (`src/lib/mock-data.ts`) instead of attempting a real call — the rest of this flow assumes full configuration.
**Hands off to:** the client, which proceeds to load history and prepare a real call.

### 3. Preload conversation history
**File:** `src/app/api/conversations/route.ts` (`GET /api/conversations`), backed by `src/lib/rag/history.ts` (`getConversationHistory`)
Fetches this session's past question/answer turns from the `conversation_turns` table so the transcript isn't empty if the overlay is reopened mid-session. Non-critical — the call proceeds even if this fails.

### 4. Prepare the call — mint a call token
**File:** `src/app/api/voice/prepare-call/route.ts` (`POST /api/voice/prepare-call`), backed by `src/lib/rag/call-token.ts` (`createCallToken`)
Vapi's servers will call this app's custom-LLM endpoint (step 7) directly, server-to-server, with no browser cookies attached — so the app's real, httpOnly session cookie can never reach that request. This same-origin call (cookies included) instead mints a short-lived, opaque `call_token` row in the `voice_call_tokens` table, mapped to the real session id.
**Hands off to:** the client, which will pass this `call_token` to Vapi.

### 5. Start the Vapi call
**File:** `src/lib/hooks/useVoiceCall.ts` (`vapi.start(...)`) → **Service:** `@vapi-ai/web` SDK / Vapi's platform
Constructs a `Vapi` client with the public key and starts a call against the configured assistant, overriding `model.url` to point at this deployment's own `/api/vapi` origin (so the same assistant config works across local/staging/production) and passing the `call_token` via both `assistantOverrides.metadata` and a custom `x-doctalk-call-token` header — two redundant delivery channels, since only one is well-documented as reliably reaching the custom-LLM request.
**Hands off to:** Vapi's own real-time infrastructure, which opens a live audio connection with the user's microphone.

### 6. Speech-to-text transcription
**Service:** Vapi Transcriber (Deepgram, via Vapi's platform)
As the user speaks, Vapi's transcription provider converts audio to text in real time. A `final` transcript for the user's turn is emitted back to the client over Vapi's WebSocket channel (handled by `vapi.on("message", ...)` in `src/lib/hooks/useVoiceCall.ts`, which appends it to the visible transcript) and, separately and independently, Vapi sends the accumulated conversation to this app's custom LLM endpoint to generate the assistant's reply.
**Hands off to:** `POST /api/vapi/chat/completions`, called directly by Vapi's servers with the full message history so far.

### 7. Resolve the call token back to a session
**File:** `src/app/api/vapi/chat/completions/route.ts`, backed by `src/lib/rag/call-token.ts` (`resolveCallToken`)
This is the OpenAI-compatible "custom LLM" endpoint Vapi calls for every assistant turn. It reads the `call_token` (checking metadata, the custom header, the request body, and the query string, in that order) and resolves it back to a real `session_id` via the `voice_call_tokens` table, rejecting tokens older than 6 hours. It also extracts the latest user message as `question` from the incoming Vapi request.
**Hands off to:** `searchDocumentChunks()`, with the resolved `sessionId` and the transcribed `question`.

### 8. Normalize spoken clause/section numbers
**File:** `src/lib/rag/search.ts` (`searchDocumentChunks`), using `src/lib/rag/normalize-spoken-numbers.ts` (`normalizeSpokenClauseNumbers`)
Before embedding the question, converts spoken-out clause references transcribed as words (e.g. "six point one point two", "five dot one dot four") into the digit form documents actually use (e.g. "6.1.2", "5.1.4"), so the query text more closely matches the source document's wording at the embedding level.
**Hands off to:** the embedding provider, with the normalized question text.

### 9. Embed the question
**Service:** Hugging Face Inference API (or OpenAI, if configured), via `getEmbeddingProvider()` in `src/lib/ai/embeddings.ts`
Generates a single embedding vector for the normalized question text, using the same provider/model that indexed the documents (dimension must match `EXPECTED_EMBEDDING_DIMENSIONS`).
**Hands off to:** the `match_document_chunks` Postgres RPC, with the query embedding.

### 10. pgvector similarity search
**Service:** Supabase Postgres — `match_document_chunks()` function (`supabase/migrations/0003_rag_and_conversation_history.sql`), called via `src/lib/rag/search.ts`
Runs a cosine-distance ordering (`<=>` operator, accelerated by the HNSW index from Flow 1) against every `document_chunks` row belonging to this session's own `ready` documents only — documents still mid-pipeline or failed are excluded since their chunks are absent or incomplete. Returns the top 5 chunks with a similarity score for each.
**Hands off to:** `classifyRetrieval()`, with the ranked list of retrieved chunks.

### 11. Classify retrieval confidence
**File:** `src/lib/rag/prompt.ts` (`classifyRetrieval`)
Classifies the result based on the top chunk's similarity score: **confident** (≥ 0.70) answers normally; **near-miss** (≥ 0.45 but < 0.70) signals a likely mismatched/mistranscribed name; **none** (< 0.45, or zero chunks) means nothing relevant was found at all.
**Hands off to:** `buildMessagesForClassification()`, with the chunks and their classification.

### 12. Build the grounded prompt (or short-circuit)
**File:** `src/lib/rag/prompt.ts` (`buildMessagesForClassification`, `buildGroundedMessages`, `buildNearMissMessages`, `NO_DOCUMENTS_ANSWER`)
For **none**, the LLM is skipped entirely — the fixed `NO_DOCUMENTS_ANSWER` string is used directly, which is what prevents hallucination on genuinely out-of-scope questions. For **confident**, builds a system+user message pair instructing the LLM to answer only from the retrieved excerpts (and to spell out clause numbers as words, not digits, since this response will be spoken aloud). For **near-miss**, builds a variant prompt asking the LLM to look for a plausible "did you mean" match within the excerpts rather than flatly saying "not found."
**Hands off to:** the LLM provider, with the finished message array (or, for "none", directly to step 15 with the fixed answer).

### 13. Generate the answer
**Service:** Groq (or OpenAI, if configured), via `getLLMProvider()` in `src/lib/ai/llm.ts` and `src/lib/ai/llm/groq.ts`
Streams a chat-completion response token-by-token from the configured LLM (default model `openai/gpt-oss-120b` on Groq) using the grounded messages from step 12.
**Hands off to:** `src/app/api/vapi/chat/completions/route.ts`, which re-emits each streamed delta.

### 14. Re-emit as OpenAI-compatible SSE
**File:** `src/app/api/vapi/chat/completions/route.ts` (`sseChunk`)
Wraps each streamed text delta from the LLM provider into an OpenAI chat-completion-chunk-shaped Server-Sent Event, so Vapi's custom-LLM integration (which expects this exact wire format) can consume it regardless of which underlying LLM provider actually generated the text.
**Hands off to:** Vapi's platform, streaming.

### 15. Text-to-speech
**Service:** Vapi TTS (Vapi's built-in voice, via Vapi's platform)
Vapi converts the streamed answer text to spoken audio in real time and plays it back to the user over the live call, while also sending the finalized assistant transcript back to the client (again via `vapi.on("message", ...)` in `src/lib/hooks/useVoiceCall.ts`, rendered with a typewriter effect in `src/components/voice/VoiceCallOverlay.tsx`).

### 16. Log the conversation turn
**File:** `src/app/api/vapi/chat/completions/route.ts` (`logTurnSafely`), backed by `src/lib/rag/history.ts` (`logConversationTurn`)
Once the full answer has streamed (or immediately, for the "none" fixed-answer path), persists the question, the final answer text, and the list of referenced document ids to the `conversation_turns` table. This happens in the background and is non-critical — a logging failure here doesn't affect the answer the user already heard.
**Hands off to:** nothing further — the turn is now part of this session's history, retrievable by step 3 the next time the call overlay opens, and browsable on the dedicated History page (`src/components/dashboard/HistoryPageContent.tsx`, `src/app/api/conversations/route.ts`).

### 17. User hangs up / call ends
**File:** `src/lib/hooks/useVoiceCall.ts` (`vapi.on("call-end", ...)`, `hangUp`)
Either the user ends the call or Vapi's platform ends it; the client stops the Vapi session and closes the overlay.
