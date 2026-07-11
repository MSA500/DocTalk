import { NextResponse } from "next/server";
import { getConfigStatus, isFullyConfiguredForVoice } from "@/lib/config-status";

export const runtime = "nodejs";

// Lets the client decide, before opening the voice overlay, whether to
// drive a real Vapi call or fall back to the Phase 1 canned demo. No
// secrets are exposed here: VAPI_PUBLIC_KEY is Vapi's own client-safe key
// (the direct equivalent of a Stripe publishable key — it's designed to
// ship in browser code, see the @vapi-ai/web quickstart), and
// VAPI_ASSISTANT_ID is just an identifier, not a credential.
// VAPI_PRIVATE_KEY is never read here or sent to the client.
export async function GET() {
  const status = getConfigStatus();
  const demoMode = !isFullyConfiguredForVoice(status);

  return NextResponse.json({
    demoMode,
    ...status,
    vapiPublicKey: status.vapiConfigured ? process.env.VAPI_PUBLIC_KEY : null,
    vapiAssistantId: status.vapiConfigured ? process.env.VAPI_ASSISTANT_ID : null,
  });
}
