# DocTalk — Project Status

## Phase 1: Frontend Skeleton — COMPLETE

Phase 1 delivers a fully static, UI/UX-only skeleton of DocTalk: a Next.js App
Router site with theming, SEO, a PWA shell, and mock/animated previews of the
dashboard and voice assistant. **No backend, API, or persistence logic is
wired up anywhere in this build.**

## Phase 1.1: Console cleanup, dashboard restructure, ambient background, cookie theming — COMPLETE

A follow-up pass covering four things: a console-error audit, a dashboard
layout change, a dark-mode-only ambient background, and replacing the theme
system with cookie-based persistence (light-default, SSR-correct, no FOUC).

### Part A — Console errors

Before changing anything, reproduction of the reported `removeChild` /
`Maximum update depth exceeded` errors was attempted by driving the app
through the Chrome DevTools Protocol: idle observation on all 4 pages, then
an aggressive
interactive stress pass (25 rapid theme-toggle clicks, rapid client-side
navigation across every nav link, rapid mobile-menu open/close, rapid
document add/remove, rapid Settings radio clicks, and toggling theme mid
voice-demo-animation). **Neither error reproduced** in the codebase as built
— code review of the three named suspects (voice demo state machine,
Typewriter, theme toggle) found no render-phase loop or manual DOM
manipulation that could cause them. The one warning that *did* reproduce
immediately — `Detected scroll-behavior: smooth on the <html> element` — is
fixed by adding `data-scroll-behavior="smooth"` to `<html>` in
`app/layout.tsx`.

Because Part D required rewriting the theme system end-to-end anyway (see
below), that rewrite also removed the one component (`useHasMounted` +
next-themes' hydration-gated `ThemeToggle`) that was the most plausible prior
source of a hydration-timing bug — the new cookie-driven theme is
SSR-correct from the first paint, so there is no client-only "mounted" gate
left anywhere in the theming code. Re-ran the full stress suite after all
Part B/C/D changes landed: still zero console errors/warnings on all 4 pages.

If this is still reproducible on your end, it would help to know: does it
happen on a cold `npm run dev` load, or only after editing files while the
dev server is running (Fast Refresh can itself cause transient `removeChild`
errors on `<header>`/`<main>`/`<footer>` that look identical to a real bug
but are a dev-tooling artifact, not an app bug)?

### Part B — Dashboard layout

Restructured `app/dashboard/page.tsx` (now just a heading + the new
`DashboardContent` client component):
- **Upload Documents** — full width, top of the page.
- **Voice Assistant** — directly below Upload, left-aligned (`max-w-md`), in
  the same left column.
- **Document Library** — moved to a right-hand sidebar column
  (`lg:sticky lg:top-24`), single-column card list (previously 2-column,
  which no longer suited the narrower sidebar).
- Document Library now has an "All documents" / "In progress" segmented
  filter control (`role="radiogroup"`) above the list.

State (the mock document list, upload handler, simulated-progress interval,
remove handler) was extracted from the old `DocumentWorkspace` component into
a `useDocumentWorkspace()` hook so Upload and Library can live in different
parts of the new grid while still sharing state. `DocumentWorkspace.tsx` was
deleted; `DashboardContent.tsx` replaces it as the state-owning client
component.

### Part C — Dark-theme-only ambient background

`components/ui/AmbientBackground.tsx`, rendered once in the root layout
(`fixed`, `-z-10`, `pointer-events-none`, `aria-hidden`), with two decorative
layers styled entirely in `styles/globals.css`:
- `.ambient-grid` — a faint 48px line grid, masked with a radial-gradient
  mask so it's strongest near center and fades out toward the edges.
- `.ambient-glow` — a large blurred radial gradient in the brand color that
  slowly drifts via a 34s `transform`-only keyframe animation
  (`translate3d` + `scale`, GPU-composited, no layout/paint thrashing).

Both layers have **no visual properties at all** in the base (light-mode)
class — the `background-image`/`background` rules only exist under the
`.dark` selector, so light mode isn't just "opacity 0," it genuinely paints
nothing extra. Verified via computed styles: `background-image: none` in
light mode, present in dark mode. The glow's animation is disabled under
`prefers-reduced-motion: reduce`.

### Part D — Cookie-based theme, light default, no FOUC

`next-themes` has been **removed** — it's localStorage-only with no built-in
cookie storage, which made it a poor fit for "readable server-side, no FOUC"
requirement. Replaced with a small custom system:
- `lib/theme-cookie.ts` — cookie name/max-age constants and a `Theme =
  "light" | "dark"` type.
- `app/layout.tsx` (now `async`) reads the `doctalk-theme` cookie via
  `cookies()` from `next/headers` and renders `<html className={theme ===
  "dark" ? "dark" : ""}>` directly — the correct theme class is present in
  the very first byte of HTML the server sends, so there is no
  flash-of-wrong-theme and no blocking inline script is needed (unlike
  next-themes, which needs one specifically because localStorage isn't
  available during SSR).
- `components/theme/ThemeProvider.tsx` — a small context provider seeded
  with the server-read `initialTheme`; `setTheme()` updates local state,
  toggles the `dark` class on `<html>`, and writes the cookie
  (`document.cookie`, `path=/`, 1-year `max-age`, `SameSite=Lax`, `Secure`
  when on HTTPS).
- New/first-time visitors (no cookie) always get **light**, never system
  preference. `ThemeToggle` and the Settings "Appearance" selector (now
  Light/Dark only — the old third "System" option was removed, since it's
  incompatible with an SSR-readable, two-state cookie) both consume this
  same `useTheme()` hook.

**Trade-off worth flagging:** because every request now reads a cookie to
decide the theme class, all routes changed from statically prerendered (`○`)
to dynamically server-rendered (`ƒ`) in the production build output. This is
the correct and necessary cost of "SSR-correct theme, no FOUC" — a fully
static page can't know the visitor's cookie at build time. Worth knowing
about if/when this gets deployed behind a CDN.

## Phase 1.2: Voice-first dashboard, fullscreen call overlay, documents page — COMPLETE

The dashboard was rebuilt around the premise that the voice assistant is
DocTalk's core deliverable, not a secondary feature living next to a file
manager. Upload and the document list are now clearly supporting actors.

### Part A — Voice Assistant is now the dominant element

`components/voice/VoiceHeroPanel.tsx` replaces the old always-looping demo
card. It's a large, centered hero panel (ambient glow, "Live preview" tag,
"Talk to DocTalk" heading, a big 96px mic button with a slow breathing-pulse
ring) that sits at the top of the dashboard's main column. It no longer
autoplays a Q&A loop on the page itself — it's an invitation to start a call,
not the conversation itself (that moved into the overlay, see Part B).

Upload was demoted to `components/dashboard/CompactUploadBar.tsx` — a slim
single-row card (icon + text + "Browse files" button) that still supports
full drag-and-drop, just without the visual weight of the old large dashed
dropzone. It now sits *below* the voice panel instead of competing with it
above.

### Part B — Fullscreen voice call overlay

`components/voice/VoiceCallOverlay.tsx`, opened by clicking the mic button
and rendered via `createPortal` into `document.body` (so it's never subject
to an ancestor's stacking context or `overflow` clipping):
- Framer Motion backdrop fade + panel scale/slide, mirrored on exit — full
  screen on mobile, a centered rounded card (92vh, max-w-2xl) from `sm:` up.
- A status block up top: `MicButton` (reused from the old demo) + a
  `Listening`/`Thinking`/`Answering`/`Muted` label + `Waveform`, plus a call
  duration timer (`0:00`, ticking every second) and a close (X) button.
- A scrollable transcript in the middle: chat bubbles, user right-aligned
  (brand-filled), assistant left-aligned, the in-progress answer revealed via
  the existing `Typewriter` component. A `ResizeObserver` on the transcript's
  content keeps it pinned to the latest message automatically, including
  while a message is still being typed (not just on new-message-added).
- A bottom control bar: mute/unmute (pauses the whole simulated
  conversation — no new turns advance while muted) and a red hang-up button.
  Escape also closes it; background scroll is locked while it's open; focus
  moves into the panel on open.
- The underlying demo state machine (listening → thinking → answering →
  pause, cycling through the same 3 canned exchanges) is the same one the
  old dashboard card used — it now *appends* to a growing transcript instead
  of overwriting a single Q/A pair, which is what makes it read as a live
  call instead of a flashcard.

This is still simulated data — see "What's real vs. mocked" below and the
note at the bottom of this section about what Phase 3 needs to wire up for
real.

### Part C — Document Library: contained scroll, Browse action, dedicated page

Previously the whole page scrolled to reveal more documents. Now:
- `DocumentLibrary` takes a `containScroll` prop. When true (used only in
  the dashboard sidebar), the list sits in a box capped at `sm:max-h-[28rem]`
  and `lg:max-h-[calc(100vh-14rem)]`, with its own `overflow-y-auto` — so on
  screens `sm:` (640px) and up, scrolling through documents scrolls *that
  box*, not the page. Verified by simulating 25 uploaded documents: the
  sidebar's internal `scrollHeight` grew to 3412px against a capped
  `clientHeight` of 676px, while the page's own `scrollHeight` moved by only
  ~64px — confirming the overflow is fully contained, not leaking to the
  page. Below `sm:` (real mobile), `containScroll` has no effect
  (`overflow-y: visible`, `max-height: none` — confirmed via computed
  styles) so mobile keeps natural full-page scroll, as intended.
- A small "Browse" button now sits next to the "Document library" heading
  in the sidebar, opening the same file picker as the compact upload bar
  (both dashboard and the new documents page share one `useDocumentWorkspace`
  hook instance per page, which now also exposes `fileInputRef`,
  `openFilePicker()`, and `handleInputChange` so any number of UI triggers
  across a page can open the same hidden `<input type="file">`).
- A "View more →" link under the heading routes to the new
  **`/dashboard/documents`** page: full document list (no scroll
  containment — it's a dedicated page, so normal page scroll is the right
  behavior there), a centered `CompactUploadBar`, and the same "All
  documents"/"In progress" toggle (it's the same `DocumentLibrary`
  component, so this came for free). Added to `app/sitemap.ts`; the footer's
  "Document Library" link now points here instead of the old
  `/dashboard#document-library` anchor.

### Verification

Beyond the usual build/lint/typecheck/audit pass, this round specifically
stress-tested the new interactive/portal-heavy code (the exact shape of bug
the Phase 1.1 console-error report was worried about) via the Chrome DevTools
Protocol: rapid open/close of the call overlay ×5, rapid mute/unmute ×10,
muting mid-conversation and confirming the transcript genuinely stops
growing (verified message count unchanged across a 4s window while muted),
plus a full re-run of the earlier stress suite (rapid theme toggles,
navigation, mobile menu, document add/remove, Settings clicks). **Zero
console errors or warnings** in any of it. Visual QA covered light/dark ×
desktop/tablet/mobile for the dashboard, the call overlay, and the new
documents page.

**Known simplification:** the dashboard and `/dashboard/documents` each hold
their own independent `useDocumentWorkspace()` instance (separate React
state), so a document uploaded on one won't appear on the other until the
data is backed by something real. Since all of it is mock, client-only state
that already resets on every reload, this doesn't add a new limitation —
just flagging it rather than letting it be a silent surprise.

---

## Stack & exact versions

All dependencies are pinned to exact versions (no `^`/`~` ranges) and were
the latest stable releases on npm at the time of this build. `npm audit`
reports **0 vulnerabilities**.

### Runtime dependencies
| Package | Version |
|---|---|
| next | 16.2.10 |
| react / react-dom | 19.2.7 |
| framer-motion | 12.42.2 |
| lucide-react | 1.23.0 |
| clsx | 2.1.1 |
| tailwind-merge | 3.6.0 |

Note: `next-themes` (0.4.6) was removed in Phase 1.1 — see Part D above. The
theme system is now a small in-repo cookie-based context provider instead.

### Dev dependencies
| Package | Version |
|---|---|
| typescript | 6.0.3 |
| tailwindcss / @tailwindcss/postcss | 4.3.2 |
| eslint | 9.39.4 |
| eslint-config-next | 16.2.10 |
| @types/node | 26.1.1 |
| @types/react | 19.2.17 |
| @types/react-dom | 19.2.3 |
| pngjs | 7.0.0 (dev-only, used by the placeholder-icon generator script) |

### Version-policy deviations (and why)
- **eslint pinned to 9.39.4, not the absolute-latest 10.6.0.** ESLint 10's
  runtime removed `context.getFilename()`, which the version of
  `eslint-plugin-react` bundled inside `eslint-config-next@16.2.10` still
  calls — linting crashed outright (`TypeError: contextOrFilename.getFilename
  is not a function`) on every file. 9.39.4 is the newest 9.x release and is
  fully compatible; lint runs clean. Revisit once `eslint-config-next` ships
  ESLint 10 support.
- **postcss pinned via `overrides` to 8.5.16.** `next@16.2.10` bundles its
  own internal copy of postcss 8.4.31, which has a known moderate-severity
  XSS advisory (GHSA-qx2v-qp2m-jg93) in CSS stringification. An `overrides`
  entry in `package.json` forces the whole tree (including Next's internal
  dependency) onto the patched 8.5.16. `npm audit` is clean as a result.

---

## Folder structure

```
app/            Routes (App Router): /, /dashboard, /dashboard/documents, /about, /settings, not-found, robots.ts, sitemap.ts, template.tsx, layout.tsx
components/     UI, split by domain: layout, theme, ui, voice, dashboard, home, settings, seo, pwa
lib/            site-config, mock-data, fonts, utils (cn), document-type helpers, voice-phase, theme-cookie, hooks/
styles/         globals.css (Tailwind v4 theme tokens, light/dark, keyframes, ambient background)
public/         icons, manifest.json, sw.js, placeholder logo SVGs
scripts/        generate-placeholder-icons.mjs (one-off, re-runnable icon generator)
```

## What's real vs. mocked

**Real (structural/functional UI, no backend):**
- Light/dark theme toggle, persisted via a first-party `doctalk-theme` cookie (not localStorage), read server-side for a correct first paint (no FOUC), defaulting new visitors to light
- Fullscreen voice call overlay: real open/close transitions, real mute (genuinely pauses the simulated conversation), real auto-scrolling transcript, real call timer, closeable via Hang Up, the X button, or Escape
- Dashboard and `/dashboard/documents` both have a working "All documents" / "In progress" filter on the Document Library, and a working "Browse" upload trigger
- Document Library scrolls within its own container on tablet/desktop (verified with 25 simulated documents) and reverts to natural full-page scroll on mobile
- Responsive header with active-link tracking and an animated mobile menu (keyboard-dismissible via Escape)
- Upload (compact bar, both dashboard and documents page) accepts real drag-and-drop / file-picker input and adds files to a client-side-only document list with a simulated progress animation (no network call, nothing persists on reload)
- Theme selector on Settings is wired to the real theme (Light/Dark)
- Typewriter, waveform, and mic-pulse animations are genuinely running (Framer Motion), not static images
- Dark-mode-only ambient background (drifting glow + faint grid), pure CSS, no effect/paint cost in light mode
- PWA manifest + service worker registration (confirmed installable; service worker registers successfully in dev)

**Mocked (fake data, no backend):**
- Document Library starter contents (`lib/mock-data.ts`)
- Voice call transcript content (loops through 3 canned question/answer pairs, appended to a growing transcript — see Phase 1.2 Part B). **Real VAPI wiring (actual speech-to-text, text-to-speech, and LLM-backed answers) is still pending for a later phase** — everything in the call overlay today is simulated timing and canned text.
- Settings profile fields (disabled inputs, placeholder values), notification toggles (local state only)
- "Processing" progress percentages (randomized client-side interval, not real upload/indexing)

## SEO / accessibility / PWA checklist

- [x] `metadata` API per route (title template, description, canonical) + Open Graph + Twitter card, using a generated placeholder `og-image.png`
- [x] `app/robots.ts` → `/robots.txt`, `app/sitemap.ts` → `/sitemap.xml` (verified served correctly)
- [x] JSON-LD `WebApplication` schema in root layout
- [x] Semantic landmarks (`header`, `nav[aria-label]`, `main`, `footer`), one `h1` per page, skip-to-content link, visible focus rings, `aria-live` status on the voice demo, `aria-checked`/`role="radio"`/`role="switch"` on custom controls
- [x] `manifest.json` + generated icon set (192/512/maskable-512/apple-touch/favicon.ico multi-size) — installable
- [x] Service worker registers (`public/sw.js`, install/activate only, no offline caching — explicitly deferred to Phase 2 via `TODO`)

## Bugs found and fixed during verification

**Phase 1** — Visual QA (headless-browser screenshots in both light/dark and
at true mobile viewport widths, plus a CDP-driven check for real layout
overflow) caught two real issues, both fixed and verified:
1. **Missing space in About page body copy** — a JSX line-wrap after
   `{siteConfig.name}` caused React to drop the following space
   ("DocTalkis..."). Fixed by collapsing the sentence into a single template
   literal expression.
2. **Hydration mismatch on the Settings theme selector** — next-themes'
   `useTheme()` returned `undefined` during SSR, so the "System" option's
   `aria-checked`/active styling didn't match between server and client
   render. Fixed at the time with a mount-guard pattern; that whole class of
   bug is now gone in Phase 1.1 since the theme is SSR-correct from a cookie
   and no client-only "mounted" gate exists anymore anywhere in the theming
   code.

**Phase 1.1** — see "Part A" above for the console-error investigation
(reported `removeChild`/`Maximum update depth exceeded` errors did not
reproduce after thorough stress testing; the real `scroll-behavior` warning
was fixed).

## `.env.local.example` — variables defined (names only, no values)

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
EMBEDDING_PROVIDER
EMBEDDING_API_KEY
EMBEDDING_MODEL
LLM_PROVIDER
LLM_API_KEY
LLM_MODEL
VAPI_PUBLIC_KEY
VAPI_PRIVATE_KEY
VAPI_ASSISTANT_ID
```
Note: `.gitignore` blanket-excludes `.env*`; an explicit `!.env.local.example`
exception was added so this template file stays tracked in git.

## Verified

- `npm run build` — clean production build, 8 routes. `/robots.txt` and
  `/sitemap.xml` remain statically prerendered (`○`); `/`, `/dashboard`,
  `/dashboard/documents`, `/about`, `/settings`, and `/_not-found` are
  dynamically server-rendered (`ƒ`) as a direct, necessary consequence of
  reading the theme cookie server-side (see Phase 1.1 Part D)
- `npm run lint` — 0 errors/warnings
- `npx tsc --noEmit` — 0 errors
- `npm audit` — 0 vulnerabilities
- Console-clean verified via Chrome DevTools Protocol across every phase of
  this project: idle load + an aggressive interactive stress pass (rapid
  theme toggling, rapid client-side navigation, rapid mobile-menu toggling,
  rapid document add/remove, rapid Settings clicks) across all pages, plus
  (Phase 1.2) rapid call-overlay open/close ×5 and rapid mute/unmute ×10 —
  zero console errors or warnings in any of it
- Manual visual QA via headless-browser screenshots: light + dark theme on
  every page, true mobile viewport (390px, verified via CDP device-metrics
  override with zero layout overflow), tablet width (820px), mobile menu
  open/close, document upload → simulated progress → ready flow, cookie-based
  theme confirmed to persist across a full reload and render correctly
  server-side (no FOUC), and (Phase 1.2) the call overlay's open/close
  transition, mute pausing the transcript, hang-up returning to the
  dashboard, and the Document Library's contained-scroll behavior confirmed
  both structurally (computed styles) and under load (25 simulated
  documents)

## Pending for Phase 2 (explicitly out of scope so far)

- Supabase integration (auth, storage, document metadata persistence)
- Real document upload/parsing pipeline + embeddings generation
- LLM-backed RAG query/answer pipeline
- Vapi voice integration — real STT/TTS and a real LLM-backed conversation
  behind the call overlay built in Phase 1.2 (today it's simulated timing +
  canned transcript content)
- Service worker offline caching strategy (currently install/activate only)
- Settings persistence (profile, notification preferences)
- Shared document state between `/dashboard` and `/dashboard/documents`
  (currently two independent client-side mock stores — see Phase 1.2 "Known
  simplification")
- Replace placeholder logo/icons/OG image with final branding
- Replace placeholder canonical domain (`https://doctalk.app`) with the real production domain

## Pending for Phase 3

- **Selective document search** — letting a user scope a RAG query to
  specific documents (rather than the whole library) is intentionally
  deferred. It's a query-time concern that only makes sense once real
  retrieval/embeddings exist, so it naturally belongs with the Phase 3 RAG
  wiring rather than the frontend skeleton.
