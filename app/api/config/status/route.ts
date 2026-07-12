import { NextResponse } from "next/server";
import { getConfigStatus, isFullyConfiguredForVoice } from "@/lib/config-status";

export const runtime = "nodejs";

// VAPI_PUBLIC_KEY is Vapi's client-safe key (like a Stripe publishable key)
// and VAPI_ASSISTANT_ID is just an identifier, not a credential — safe to
// send to the client. VAPI_PRIVATE_KEY is never read or sent here.
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
