"use client";

import { usePathname } from "next/navigation";

// Routes meant to be embedded (e.g. inside the mobile app's WebView) render
// without the site chrome — no header/nav/footer — since they're never
// visited directly by a normal browser user. An explicit allowlist rather
// than a prefix match, so this can't accidentally swallow a real page.
const CHROME_FREE_ROUTES = new Set(["/voice/embed"]);

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (CHROME_FREE_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
