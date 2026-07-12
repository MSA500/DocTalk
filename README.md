# DocTalk

DocTalk is a voice-powered document assistant. Upload your PDFs, Word documents, or text files, and simply talk to DocTalk to get instant, accurate answers grounded entirely in your own content — no hallucinations, no guesswork. Powered by retrieval-augmented generation and real-time voice AI, DocTalk turns your documents into a conversation.

**Live deployment:** [https://doc-talk-buddy.vercel.app](https://doc-talk-buddy.vercel.app)

## Tech stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Styling:** Tailwind CSS 4
- **Database + storage:** Supabase (Postgres, pgvector, Storage)
- **Embeddings:** Hugging Face (`sentence-transformers/all-MiniLM-L6-v2`, default) or OpenAI, swappable via env vars
- **LLM:** Groq (`openai/gpt-oss-120b`, default) or OpenAI, swappable via env vars
- **Voice:** Vapi (real-time speech-to-text, text-to-speech, and call orchestration)
- **Document parsing:** `unpdf` (PDF), `mammoth` (DOCX)
- **Animation:** Framer Motion
- **PWA:** installable, with an offline fallback page and a service worker

## Architecture: the RAG pipeline

```mermaid
flowchart TD
    subgraph Ingestion["Document ingestion"]
        A["User uploads a PDF, DOCX, or TXT file"] --> B["POST /api/documents/upload<br/>validate + store raw file in Supabase Storage"]
        B --> C["POST /api/documents/[id]/process"]
        C --> D["Extract text<br/>unpdf / mammoth / plain read"]
        D --> E["Chunk text<br/>lib/documents/chunk-text.ts"]
        E --> F["Generate embeddings<br/>Hugging Face or OpenAI"]
        F --> G[("Store chunks + vectors<br/>document_chunks (pgvector)")]
    end

    subgraph Query["Voice query"]
        H["User asks a question by voice"] --> I["Vapi: speech-to-text"]
        I --> J["POST /api/vapi/chat/completions"]
        J --> K["Embed the question"]
        K --> L["Vector similarity search<br/>match_document_chunks RPC"]
        L --> M{"Similarity classification"}
        M -->|confident| N["Build grounded prompt<br/>with retrieved excerpts"]
        M -->|near-miss| O["Build clarifying prompt<br/>(\"did you mean...\")"]
        M -->|none| P["Return a fixed \"not found\" answer<br/>no LLM call"]
        N --> Q["Groq or OpenAI LLM<br/>generates a grounded answer"]
        O --> Q
        Q --> R["Stream the answer back to Vapi"]
        P --> R
        R --> S["Vapi: text-to-speech"]
        S --> T["User hears the answer"]
        Q --> U[("Log the turn<br/>conversation_turns")]
    end

    G -.->|retrieved by| L
```

Retrieval is grounded: if nothing relevant is found in the user's own documents, the LLM is never called and DocTalk says so plainly instead of guessing. See `lib/rag/prompt.ts` for the similarity-threshold logic behind the confident / near-miss / none classification.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values below. The example file has detailed comments for each one, including the exact SQL to run if you change `EMBEDDING_MODEL` to a model with a different vector dimension.

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Your Supabase project URL (Project Settings > API). |
| `SUPABASE_ANON_KEY` | No | Client-safe key; not currently used by any code path. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key, bypasses Row Level Security. Never expose to the client. |
| `EMBEDDING_PROVIDER` | Yes | `huggingface` (default) or `openai`. |
| `EMBEDDING_API_KEY` | Yes | API key for the embedding provider. |
| `EMBEDDING_MODEL` | No | Overrides the provider's default embedding model. Changing dimension requires a DB migration — see `.env.local.example`. |
| `LLM_PROVIDER` | Yes | `groq` (default) or `openai`. |
| `LLM_API_KEY` | Yes | API key for the LLM provider. |
| `LLM_MODEL` | No | Overrides the provider's default chat model. |
| `VAPI_PUBLIC_KEY` | Yes, for real voice calls | Client-safe Vapi key, served to the browser via `/api/config/status`. |
| `VAPI_PRIVATE_KEY` | No | Server-only, used only by `scripts/create-vapi-assistant.mjs` to provision the assistant. |
| `VAPI_ASSISTANT_ID` | Yes, for real voice calls | The Vapi assistant DocTalk's voice overlay connects to. |

If `VAPI_PUBLIC_KEY` or `VAPI_ASSISTANT_ID` (or any embedding/LLM/Supabase variable) is missing, DocTalk automatically falls back to a demo mode for the voice overlay instead of failing outright.

## Local development

**Prerequisites:** Node.js 20+, a Supabase project, and API keys for your chosen embedding and LLM providers.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up the database**

   In your Supabase project's SQL editor, run the migrations in order:

   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_granular_processing_stages.sql
   supabase/migrations/0003_rag_and_conversation_history.sql
   ```

   This creates the `documents`, `document_chunks`, `conversation_turns`, and `voice_call_tokens` tables, enables the `pgvector` extension, sets up the vector similarity search function, and creates a private `documents` storage bucket.

3. **Configure environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in the values described in the table above.

4. **(Optional) Provision a Vapi assistant**

   Real voice calls require a Vapi assistant pointed at this app's custom-LLM endpoint. Vapi calls your app server-to-server, so `localhost` won't work — use a tunnel (e.g. `ngrok`, `cloudflared`) for local testing:

   ```bash
   node scripts/create-vapi-assistant.mjs https://your-tunnel-url.example.com
   ```

   Add the printed `VAPI_ASSISTANT_ID` to `.env.local`. Without this step, the app still runs — the voice overlay just uses its demo mode instead of a live call.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

6. **Try it out**

   Upload one of the sample documents in `samples/` (a PDF, a DOCX, and a TXT file are included for testing) from the dashboard, then open the voice assistant and ask it a question about the document's content.

## Other scripts

- `npm run build` — production build
- `npm run start` — run a production build locally
- `npm run lint` — ESLint
- `node scripts/generate-icons.mjs` — regenerates favicons/PWA icons/OG image from the logo mark in `components/ui/Logo.tsx`
- `node scripts/generate-sample-documents.mjs` — regenerates the sample PDF/DOCX files in `samples/`

## Deployment

DocTalk is deployed on Vercel at [https://doc-talk-buddy.vercel.app](https://doc-talk-buddy.vercel.app).

1. Push the repository to GitHub and import it into [Vercel](https://vercel.com/new).
2. Add all required environment variables (see the table above) in the Vercel project's settings.
3. Deploy. Vercel builds and serves the app automatically on every push.
4. Run the Supabase migrations against your production database, if you haven't already (see step 2 under Local development).
5. Provision or update the Vapi assistant so `model.url` points at your live deployment URL:

   ```bash
   node scripts/create-vapi-assistant.mjs https://doc-talk-buddy.vercel.app
   ```

## Project structure

```
src/app/              Next.js App Router pages and API routes
src/components/       React components (dashboard, voice, layout, PWA, UI primitives)
src/lib/              Core logic: RAG pipeline, AI provider adapters, document processing, hooks
src/styles/           globals.css (Tailwind theme tokens, light/dark, keyframes)
src/proxy.ts          Session cookie assignment (Next.js's "proxy," formerly "middleware")
public/               Static assets, PWA manifest, service worker, offline fallback page
samples/              Sample PDF/DOCX/TXT documents for testing the upload and RAG pipeline
scripts/              One-off setup/build scripts (icon generation, sample docs, Vapi provisioning)
supabase/migrations/  Database schema migrations, applied in order via the Supabase SQL editor
```

Application code lives under `src/`; config files (`package.json`, `next.config.ts`, `tsconfig.json`), `public/`, `samples/`, `scripts/`, and `supabase/` stay at the project root, per Next.js's `src` folder convention.
