import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLLMProvider } from "@/lib/ai/llm";
import { searchDocumentChunks } from "@/lib/rag/search";
import { buildGroundedMessages, NO_DOCUMENTS_ANSWER } from "@/lib/rag/prompt";
import { logConversationTurn } from "@/lib/rag/history";
import { resolveCallToken } from "@/lib/rag/call-token";

export const runtime = "nodejs";
export const maxDuration = 60;

// The OpenAI-compatible "custom LLM" endpoint Vapi calls directly (server
// to server) for every assistant turn — see the assistant's
// model.provider="custom-llm"/model.url config. Vapi sends a standard
// OpenAI chat-completions request ({ model, messages, stream, ... }) and
// expects a standard OpenAI chat-completion response back, streamed as SSE
// when stream:true (which Vapi always sends). This route resolves the
// call_token query param (see /api/voice/prepare-call) back to a real
// session_id, runs the same retrieve -> ground -> generate pipeline as
// POST /api/rag/answer, and re-emits the LLM provider's plain-text deltas
// as OpenAI-chunk-shaped SSE frames so the underlying provider stays fully
// swappable — Vapi never sees which provider actually generated the text.

type VapiChatMessage = { role: string; content: string };

const encoder = new TextEncoder();

function sseChunk(model: string, contentDelta: string | null, finishReason: string | null) {
  const payload = {
    id: `doctalk-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: contentDelta === null ? {} : { content: contentDelta },
        finish_reason: finishReason,
      },
    ],
  };
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function nonStreamingCompletion(model: string, content: string) {
  return {
    id: `doctalk-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  };
}

function respondWithFixedMessage(model: string, message: string, wantsStream: boolean) {
  if (!wantsStream) {
    return NextResponse.json(nonStreamingCompletion(model, message));
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk(model, message, null));
      controller.enqueue(sseChunk(model, null, "stop"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function logTurnSafely(
  supabase: SupabaseClient,
  sessionId: string,
  question: string,
  answer: string,
  referencedDocumentIds: string[],
) {
  try {
    await logConversationTurn(supabase, sessionId, question, answer, referencedDocumentIds);
  } catch (err) {
    console.error("Failed to log conversation turn (Vapi path):", err);
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  let body: {
    model?: string;
    messages?: VapiChatMessage[];
    stream?: boolean;
    metadata?: { callToken?: string };
    callToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Three independent channels for the same call token, tried in order of
  // how well-documented/reliable each is confirmed to be. The client (see
  // lib/hooks/useVoiceCall.ts) currently sends both metadata and the
  // header on every call; query string and top-level body.callToken are
  // defensive fallbacks for assistant configs that might deliver it
  // differently (e.g. metadataSendMode: "destructured").
  const metadataToken = body.metadata?.callToken ?? null;
  const headerToken = request.headers.get("x-doctalk-call-token");
  const bodyToken = body.callToken ?? null;
  const queryToken = url.searchParams.get("callToken");
  const callToken = metadataToken || headerToken || bodyToken || queryToken;

  console.log(
    `/api/vapi/chat/completions: metadataToken=${metadataToken ? "present" : "absent"} headerToken=${headerToken ? "present" : "absent"} bodyToken=${bodyToken ? "present" : "absent"} queryToken=${queryToken ? "present" : "absent"} resolvedCallToken=${callToken ? "present" : "MISSING"}`,
  );

  const model = body.model || "doctalk-rag";
  const wantsStream = body.stream !== false;

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return respondWithFixedMessage(
      model,
      "DocTalk isn't fully configured on the server right now, so I can't answer questions yet.",
      wantsStream,
    );
  }

  const sessionId = callToken ? await resolveCallToken(supabase, callToken) : null;
  console.log(`/api/vapi/chat/completions: resolved sessionId=${sessionId ?? "NONE"}`);
  if (!sessionId) {
    return respondWithFixedMessage(
      model,
      "I couldn't verify this call's session. Please try closing and reopening the call.",
      wantsStream,
    );
  }

  const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
  const question = [...incomingMessages].reverse().find((m) => m.role === "user")?.content?.trim();

  if (!question) {
    return respondWithFixedMessage(model, "I didn't catch a question — could you ask again?", wantsStream);
  }

  console.log(`/api/vapi/chat/completions: question="${question}"`);

  try {
    const chunks = await searchDocumentChunks(supabase, sessionId, question);
    const referencedDocumentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));

    if (chunks.length === 0) {
      void logTurnSafely(supabase, sessionId, question, NO_DOCUMENTS_ANSWER, referencedDocumentIds);
      return respondWithFixedMessage(model, NO_DOCUMENTS_ANSWER, wantsStream);
    }

    const groundedMessages = buildGroundedMessages(question, chunks);
    const provider = getLLMProvider();

    if (!wantsStream) {
      const answer = await provider.complete(groundedMessages);
      // Logged here, before any further handling, specifically so a
      // garbled-in-speech report can be checked against the exact raw text
      // the LLM produced — if this log line already looks garbled, the
      // problem is upstream of Vapi/TTS; if it reads cleanly, the problem
      // is in Vapi's TTS pronunciation, not our pipeline.
      console.log(`/api/vapi/chat/completions: raw answer text (non-streaming) = ${JSON.stringify(answer)}`);
      void logTurnSafely(supabase, sessionId, question, answer, referencedDocumentIds);
      return NextResponse.json(nonStreamingCompletion(provider.model, answer));
    }

    const stream = new ReadableStream({
      async start(controller) {
        let fullAnswer = "";
        try {
          for await (const delta of provider.stream(groundedMessages)) {
            fullAnswer += delta;
            controller.enqueue(sseChunk(provider.model, delta, null));
          }
          controller.enqueue(sseChunk(provider.model, null, "stop"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          const fallbackMessage = "Sorry, I ran into a problem generating that answer.";
          controller.enqueue(sseChunk(provider.model, fallbackMessage, "stop"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          fullAnswer = fullAnswer || fallbackMessage;
          console.error("Streaming answer failed:", err);
        } finally {
          // Same reasoning as the non-streaming log above — this is the
          // exact concatenation of every delta actually sent to Vapi.
          console.log(`/api/vapi/chat/completions: raw answer text (streamed) = ${JSON.stringify(fullAnswer)}`);
          controller.close();
          void logTurnSafely(supabase, sessionId, question, fullAnswer, referencedDocumentIds);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    console.error("RAG pipeline failed for Vapi request:", err);
    return respondWithFixedMessage(
      model,
      "Sorry, something went wrong while looking that up. Please try again.",
      wantsStream,
    );
  }
}
