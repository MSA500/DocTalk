# DocTalk — Project Status

## Phase 1: Frontend Skeleton — COMPLETE

Phase 1 delivers a fully static, UI/UX-only skeleton of DocTalk: a Next.js App
Router site with theming, SEO, a PWA shell, and mock/animated previews of the
dashboard and voice assistant. **No backend, API, or persistence logic is
wired up anywhere in this build.**

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
| next-themes | 0.4.6 |
| clsx | 2.1.1 |
| tailwind-merge | 3.6.0 |

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
app/            Routes (App Router): /, /dashboard, /about, /settings, not-found, robots.ts, sitemap.ts, template.tsx, layout.tsx
components/     UI, split by domain: layout, theme, ui, voice, dashboard, home, settings, seo, pwa
lib/            site-config, mock-data, fonts, utils (cn), document-type helpers, hooks/
styles/         globals.css (Tailwind v4 theme tokens, light/dark, keyframes)
public/         icons, manifest.json, sw.js, placeholder logo SVGs
scripts/        generate-placeholder-icons.mjs (one-off, re-runnable icon generator)
```

## What's real vs. mocked

**Real (structural/functional UI, no backend):**
- Light/dark theme toggle (persisted via `next-themes`, class-based, respects system preference)
- Responsive header with active-link tracking and an animated mobile menu (keyboard-dismissible via Escape)
- Upload area accepts real drag-and-drop / file-picker input and adds files to a client-side-only document list with a simulated progress animation (no network call, nothing persists on reload)
- Theme selector on Settings is wired to the real theme (Light/Dark/System)
- Typewriter, waveform, and mic-pulse animations are genuinely running (Framer Motion), not static images
- PWA manifest + service worker registration (confirmed installable; service worker registers successfully in dev)

**Mocked (fake data, no backend):**
- Document Library starter contents (`lib/mock-data.ts`)
- Voice Assistant Q&A exchanges (loops through 3 canned question/answer pairs)
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

Visual QA (headless-browser screenshots in both light/dark and at true mobile
viewport widths, plus a CDP-driven check for real layout overflow) caught two
real issues, both now fixed and verified:
1. **Missing space in About page body copy** — a JSX line-wrap after
   `{siteConfig.name}` caused React to drop the following space
   ("DocTalkis..."). Fixed by collapsing the sentence into a single template
   literal expression.
2. **Hydration mismatch on the Settings theme selector** — `useTheme()`
   returns `undefined` during SSR, so the "System" option's
   `aria-checked`/active styling didn't match between server and client
   render. Fixed with the same mount-guard pattern (`useHasMounted`, backed
   by `useSyncExternalStore`) already used in the header's `ThemeToggle`.

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

- `npm run build` — clean production build, all 7 routes statically prerendered
- `npm run lint` — 0 errors/warnings
- `npx tsc --noEmit` — 0 errors
- `npm audit` — 0 vulnerabilities
- Manual visual QA via headless-browser screenshots: light + dark theme on
  Home/Dashboard/About/Settings/404, true mobile viewport (390px, verified
  via CDP with zero layout overflow), mobile menu open/close interaction,
  document upload → simulated progress → ready flow

## Pending for Phase 2 (explicitly out of scope for Phase 1)

- Supabase integration (auth, storage, document metadata persistence)
- Real document upload/parsing pipeline + embeddings generation
- LLM-backed RAG query/answer pipeline
- Vapi voice integration (real STT/TTS, not the current animated mock)
- Service worker offline caching strategy (currently install/activate only)
- Settings persistence (profile, notification preferences)
- Replace placeholder logo/icons/OG image with final branding
- Replace placeholder canonical domain (`https://doctalk.app`) with the real production domain
