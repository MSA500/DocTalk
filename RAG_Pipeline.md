## Architecture: the RAG pipeline

Files are uploaded directly from the browser to Supabase Storage (not routed through a Vercel serverless function), and large documents are indexed across many short, resumable processing steps rather than one long request. For the complete, step-by-step breakdown of every file, route, and service involved in both flows — see **[pipeline.md](./pipeline.md)**.

```mermaid
flowchart TD
    subgraph Ingestion["Document upload and indexing"]
        A["User selects a PDF, DOCX, or TXT file, up to 15 MB"] --> B["POST /api/documents/prepare-upload<br/>validate, create the document row,<br/>request a signed Supabase Storage upload URL"]
        B --> C["Browser PUTs the file directly to Supabase Storage<br/>bypasses the Vercel function body-size limit"]
        C --> D["POST /api/documents/[id]/confirm-upload<br/>verify the file actually landed in Storage"]
        D --> E["POST /api/documents/[id]/process<br/>repeated calls, one bounded step each"]
        E --> F["Extract text<br/>unpdf / mammoth / plain read"]
        F --> G["Chunk text<br/>lib/documents/chunk-text.ts"]
        G --> H["Generate embeddings in batches<br/>Hugging Face or OpenAI, resumable"]
        H --> I[("Store chunks + vectors<br/>document_chunks (pgvector)")]
    end

    subgraph Query["Voice question and answer"]
        J["User presses the mic button"] --> K["POST /api/voice/prepare-call<br/>mint a short-lived call_token for this session"]
        K --> L["Vapi call starts; user speaks"]
        L --> M["Vapi: speech-to-text (Deepgram)"]
        M --> N["POST /api/vapi/chat/completions<br/>resolve call_token back to session_id"]
        N --> O["Normalize spoken clause numbers<br/>e.g. six point one point two to 6.1.2"]
        O --> P["Embed the question"]
        P --> Q["Vector similarity search<br/>match_document_chunks RPC"]
        Q --> R{"Similarity classification"}
        R -->|confident| S["Build grounded prompt<br/>with retrieved excerpts"]
        R -->|near-miss| T["Build a clarifying did-you-mean prompt"]
        R -->|none| U["Return a fixed not-found answer<br/>no LLM call"]
        S --> V["Groq or OpenAI LLM<br/>generates a grounded answer"]
        T --> V
        V --> W["Stream the answer back to Vapi as SSE"]
        U --> W
        W --> X["Vapi: text-to-speech"]
        X --> Y["User hears the answer"]
        V --> Z[("Log the turn<br/>conversation_turns")]
    end

    I -.->|retrieved by| Q
```

Retrieval is grounded: if nothing relevant is found in the user's own documents, the LLM is never called and DocTalk says so plainly instead of guessing. See `lib/rag/prompt.ts` for the similarity-threshold logic behind the confident / near-miss / none classification, and `lib/rag/normalize-spoken-numbers.ts` for how spoken clause/section references (e.g. "six point one point two") are converted to digit form ("6.1.2") before the question is embedded, so retrieval isn't thrown off by how voice transcription renders numbers.
