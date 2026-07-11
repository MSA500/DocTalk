// One-time (or re-run-to-update) setup: creates or updates the DocTalk
// voice assistant on your Vapi account via Vapi's REST API, pointed at this
// app's custom-LLM endpoint, instead of clicking through the dashboard by
// hand. Requires VAPI_PRIVATE_KEY in .env.local and your app's public,
// internet-reachable base URL (Vapi's servers call this URL directly —
// localhost will not work; use a tunnel like ngrok/cloudflared for local
// testing, or your real deployment URL).
//
// Usage:
//   node scripts/create-vapi-assistant.mjs https://your-app.example.com
//
// Re-run with the same URL any time the app's domain changes (e.g. after a
// tunnel restart) — if VAPI_ASSISTANT_ID is already set in .env.local, this
// updates that assistant in place instead of creating a duplicate.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  const env = {};
  let content;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    console.error(`Could not read ${envPath}. Create .env.local first (see .env.local.example).`);
    process.exit(1);
  }
  for (const line of content.split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key || key.startsWith("#")) continue;
    env[key] = value;
  }
  return env;
}

const appUrl = process.argv[2];
if (!appUrl || !/^https?:\/\//.test(appUrl)) {
  console.error("Usage: node scripts/create-vapi-assistant.mjs https://your-public-app-url.example.com");
  console.error("This must be a real, internet-reachable URL — Vapi's servers call it directly, so localhost will not work without a tunnel.");
  process.exit(1);
}

const env = loadEnv();
const privateKey = env.VAPI_PRIVATE_KEY;
if (!privateKey) {
  console.error("VAPI_PRIVATE_KEY is not set in .env.local.");
  process.exit(1);
}

const assistantConfig = {
  name: "DocTalk",
  firstMessage: "Hi, I'm DocTalk. Ask me anything about your uploaded documents.",
  model: {
    provider: "custom-llm",
    model: "doctalk-rag",
    // Overridden per call by lib/hooks/useVoiceCall.ts anyway (so the same
    // assistant keeps working if the app's URL changes), but Vapi requires
    // a valid value here at creation time.
    url: `${appUrl.replace(/\/$/, "")}/api/vapi`,
  },
  // Vapi's own built-in voice — works immediately with any Vapi account, no
  // separate TTS provider key required. Swap for another provider/voiceId
  // in the dashboard afterward if you'd prefer a different voice.
  voice: {
    provider: "vapi",
    voiceId: "Elliot",
  },
};

const existingId = env.VAPI_ASSISTANT_ID;
const url = existingId ? `https://api.vapi.ai/assistant/${existingId}` : "https://api.vapi.ai/assistant";
const method = existingId ? "PATCH" : "POST";

const response = await fetch(url, {
  method,
  headers: {
    Authorization: `Bearer ${privateKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(assistantConfig),
});

const body = await response.json();

if (!response.ok) {
  console.error(`Vapi API request failed (${response.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}

if (existingId) {
  console.log(`Updated assistant ${existingId} — model.url is now ${assistantConfig.model.url}`);
} else {
  console.log(`Created assistant ${body.id}`);
  console.log(`Add this to .env.local: VAPI_ASSISTANT_ID=${body.id}`);
}
