import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE, isValidSessionId } from "@/lib/session-cookie";

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionId(existing)) {
    return NextResponse.next();
  }

  const sessionId = crypto.randomUUID();
  request.cookies.set(SESSION_COOKIE, sessionId);

  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
