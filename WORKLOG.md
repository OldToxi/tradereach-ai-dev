# WORKLOG — TradeReach AI

Append-only. Newest entries at the bottom of `## Log`. One entry per completed task.
`## Handoff` is rewritten in full whenever an agent stops.

**Entry template — copy this exactly:**

```
### T4.2 — company detail facts panel
- when: 2026-09-18 14:20 UTC
- agent: claude-code
- files: app/companies/[id]/page.tsx, components/FactRow.tsx, lib/facts.ts
- done: fact rows render with provenance badges; promote-to-verified writes confirmed_by + audit
- verified: `npm run verify` green; manually promoted a fact as rifat, audit row appeared
- notes: RLS refused the promote as nusrat, as intended — no code change needed
- surprises: none
```

`surprises` is the important field. Anything that contradicts `PLAN.md` goes there, and if
it changes later tasks, edit `PLAN.md` too and say so.

---

<!-- PROGRESS:START -->
`█████████░░░░░░░░░░░░░░░░░░░░░` **31%** — 24 of 78 tasks complete

| Phase | Done | Total |
|---|---|---|
| 0 · Human setup | 5 | 6 |
| 1 · Foundation | 10 | 10 ✓ |
| 2 · Auth & shell | 5 | 5 ✓ |
| 3 · Catalog | 4 | 4 ✓ |
| 4 · Companies & research | 0 | 7 |
| 5 · AI research pack | 0 | 6 |
| 6 · Decision-makers | 0 | 4 |
| 7 · Drafting & review | 0 | 7 |
| 8 · Gmail connector | 0 | 5 |
| 9 · Replies & triage | 0 | 6 |
| 10 · Meetings & pipeline | 0 | 7 |
| 11 · Control surfaces | 0 | 5 |
| 12 · Tests, docs, deploy | 0 | 6 |
<!-- PROGRESS:END -->

Regenerate with `npm run progress`. Do not hand-edit between the markers.

---

## Log

### T0.0 — repo initialised
- when: (fill in)
- agent: (human)
- files: AGENTS.md, PLAN.md, WORKLOG.md, SETUP.md, .env.example, design/mock-ui.html
- done: planning bundle in place, nothing built yet
- verified: n/a
- notes: mock UI opens in a browser and is the visual spec
- surprises: none

---

### T0.1–T0.6 & T1.1–T1.10 — foundation complete (reconciliation)
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: supabase/migrations/*, lib/session.ts, lib/audit.ts, lib/supabase/{server,admin}.ts, lib/database.types.ts, scripts/seed.ts, vitest.config.ts, tests/setup-env.ts
- done: |
    Repo created and pushed (private, main). Google Cloud OAuth (gmail.compose + calendar,
    Testing) and Supabase project configured; `.env.local` filled (gitignored).
    Migrations 0001/0002/0003 applied via `supabase db push`; custom access token hook
    enabled in the dashboard and verified (JWT carries role + markets).
    Next scaffold (App Router + TS + Tailwind) with `npm run verify` (typecheck + lint + tests).
    `lib/database.types.ts` generated (converted to UTF-8). `lib/supabase/server.ts` and
    `admin.ts` in place. `lib/session.ts` and `lib/audit.ts` verified. Seed ran successfully
    (5 users + demo companies/contacts/messages).
- verified: `npm run verify` green; seed output lists 5 users; JWT app_metadata checked for rifat
- notes: a prior agent completed this work but did not tick PLAN.md or log it — this entry reconciles both.
- surprises: T0.4 was completed against DeepSeek (Anthropic-compatible endpoint), not Anthropic. T1.5 auth hook required manual enable in the Supabase dashboard.

---

### T1.2 — Tailwind theme + provenance badges
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: tailwind.config.ts, app/globals.css, app/layout.tsx, components/ui/Provenance.tsx
- done: mapped the mock `:root` palette + dark tokens into the Tailwind theme; copied base and component CSS (prov, tag, btn, card, shell, login); Archivo + Spline Sans Mono via next/font; theme init inline script
- verified: `npm run verify` green; `npm run build` clean
- notes: badge tints use `color-mix` as in the mock; dark mode via media query + `data-theme`
- surprises: none

---

### T2.1 — middleware session refresh + route protection
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: middleware.ts
- done: `@supabase/ssr` client in middleware; `getUser()`; unauthenticated requests redirect to `/login?next=…`
- verified: `curl /dashboard` → 307 → `/login?next=%2Fdashboard`; `/login` → 200
- surprises: none

---

### T2.2 — /login
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: app/login/page.tsx, components/LoginForm.tsx, components/Logo.tsx, lib/auth-actions.ts
- done: ported the mock sign-in screen; real email/password auth via Supabase; role note + demo role list; `SIGNED_IN` audit write
- verified: `npm run verify` green; `/login` returns 200 with the mock copy
- notes: "Continue with Google Workspace" is present but disabled (SSO arrives with the Gmail connector phase)
- surprises: none

---

### T2.3 — app shell
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: components/AppShell.tsx, components/ThemeToggle.tsx, app/(app)/layout.tsx, app/page.tsx, app/(app)/*/page.tsx
- done: left rail with the mock's groups and routes; top bar (search, theme toggle, add company); mobile drawer; dashboard greeting; placeholder pages for every route
- verified: `npm run build` clean — all 17 routes compiled
- notes: nav badges not yet wired to live data; the mock's "Build notes" rail item dropped (mock-internal docs)
- surprises: none

---

### T2.4 — role-aware rail
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: lib/nav.ts, tests/nav.test.ts
- done: `navForRole()` hides "Settings & access" from non-managers; crumb resolver; test covers the rule
- verified: 5 new tests pass (37 total)
- surprises: none

---

### T2.5 — sign out + rail foot
- when: 2026-09-18 12:21 UTC
- agent: opencode
- files: lib/auth-actions.ts, components/AppShell.tsx
- done: `signOut` server action redirects to `/login`; rail foot shows signed-in name + role label + sign out
- verified: `npm run verify` green; `npm run build` clean
- notes: idle session expiry is the Supabase default (30 min)
- surprises: none

---

### T2 fix — role claims must be read from the JWT, not `user.app_metadata`
- when: 2026-09-18 12:31 UTC
- agent: opencode
- files: lib/session.ts
- done: `currentUser()` now decodes `session.access_token` and reads `app_metadata.role`/`markets` from the JWT payload; sign-in produced a blank dashboard before this because `getUser().app_metadata` (the GoTrue `/user` endpoint) returns the database copy, which never carries the hook's claims.
- verified: `npm run verify` green; end-to-end — signed in as rifat via supabase-js, built the `@supabase/ssr` cookie, fetched `/dashboard` → 200 with greeting, role "Export Manager", full name, and manager-only "Settings & access" present.
- notes: the hook mutates the token only (confirmed by decoding the JWT); this is what `0003_auth_hook.sql`'s own verify snippet checks. `lib/session.ts` was written against the wrong source.
- surprises: **contradicts the comment in `lib/session.ts`/`PLAN.md` T1.5** — `user.app_metadata` does NOT carry hook claims; only the raw JWT does. Worth a regression test if auth is ever touched again.

---

### T3.1 — /products list + Add product modal + capability sheet detail
- when: 2026-09-18 12:47 UTC
- agent: opencode
- files: app/(app)/products/page.tsx, components/ProductsScreen.tsx, components/ProductModal.tsx, lib/catalog.ts, lib/product-actions.ts, lib/audit.ts, app/globals.css, app/layout.tsx, scripts/seed.ts, tests/catalog.test.ts
- done: `/products` server page fetches product/market/company via the user JWT, derives target markets (`marketsForProduct`, noun-based so "Woven jute bags" ≠ "jute yarn") and active leads (non-disqualified companies per product). Client screen renders the table, a capability-sheet detail panel (verified provenance badge + sample-policy note when `is_sample`), an "AI analysis" placeholder, and an Add/Edit modal wired to the `saveProduct` server action (manager-only via `canManageCatalog`). Role gating shown in UI and enforced by `product_write` RLS.
- verified: `npm run verify` green (40 tests, incl. new `tests/catalog.test.ts`); e2e on :3001 — manager sees all 4 products + Add/Edit, executive sees products but no add/edit; direct RLS probe: executive insert blocked, manager insert ok (cleaned up).
- notes: `saveProduct` writes via the user client + `requirePermission('product:write')`, audits `PRODUCT_ADDED`/`PRODUCT_EDITED`; `revalidatePath('/products')`.
- surprises: **the seed had never actually inserted products.** `product` has no unique constraint on `name`, so the old `upsert(..., { onConflict: 'name' })` threw "no unique or exclusion constraint" which `seedCatalog` ignored — products were 0 rows since Phase 1 while the log claimed "4 products". Fixed to select-then-insert/update and now the seed throws on catalog errors. Also fixed the "all companies = Jute yarn" gap with a `PRODUCT_BY_KEY` map.

---

### T3.2 — capability sheet is the only AI context; reserved-field allowlist
- when: 2026-09-18 12:53 UTC
- agent: opencode
- files: lib/ai/context.ts, lib/guardrails.ts, tests/context.test.ts
- done: `lib/ai/context.ts` now has a single `isReservedKey()` predicate backed by an over-catching `RESERVED_KEY_FRAGMENTS` list that covers all 13 reserved matters (price, payment, credit, MOQ, freight, delivery, samples, exclusivity, distributor appointment, warranty, technical compliance, discount/rebate, contract). `stripReserved` and `buildCompanyContext` both use it. `buildProductContext` reads through a named `PRODUCT_CONTEXT_COLUMNS` allowlist (name, hs_code, certifications, monthly_capacity, lead_time, capability_sheet). `lib/guardrails.ts` now exports `RESERVED_MATTERS` as the single source of truth.
- verified: `npm run verify` green — 69 tests, incl. new `tests/context.test.ts` (29) asserting every `RESERVED_MATTER` and synonym is reserved, allowed fields (`lead_time`, `capacity`, `certifications`, `capability_sheet`) are NOT, and the product allowlist is reserved-free.
- notes: `lead_time` is deliberately NOT reserved — it is an allowed capability-sheet field; reserving it would have neutered the drafts. The old `RESERVED_KEYS` list was missing `samples`, `distributor_appointment`, `technical_compliance`, `rebate`; a fact keyed `unit_price` or `sample_policy` would have leaked.
- surprises: the previous `RESERVED_KEYS` list did not cover several matters from the brief, and `buildProductContext` used a literal select string so its allowlist was not testable. Both now fixed and tested.

---

### T3.3 — /markets list + Add market modal + market note detail with provenance badges
- when: 2026-09-18 19:10 UTC
- agent: opencode
- files: supabase/migrations/0004_market_note.sql, lib/database.types.ts (regen), scripts/seed.ts, lib/catalog.ts, lib/market-actions.ts, components/MarketModal.tsx, components/MarketsScreen.tsx, app/(app)/markets/page.tsx, tests/catalog.test.ts
- done: migration `0004_market_note.sql` adds the `market_note` table (`id, market_id → market, key, value, provenance, source_label, confirmed_by, confirmed_at`) with `market_note_read` (all signed-in) and `market_note_write` (manager) policies, applied via `supabase db push`; types regenerated. Seed gained `MARKET_NOTES` + `seedMarketNotes()` and `reset()` now clears `market_note` (reseed → 27 notes). `/markets` server page fetches `market`/`market_note`/`company`/`product` through the user JWT, derives per-market company counts and sorts notes in the mock's canonical order (`marketNoteOrderIndex`). `MarketsScreen` renders the table (priority/status tags), the market-note card with provenance badges (custom `source_label` text, e.g. "UN Comtrade 2025", "AI inferred from 9 replies", "Needs re-check for 2026"), and the outreach-guardrails card (send window / volume cap / required-before-sending / legal note). `MarketModal` + `saveMarket` server action (manager-only) add/edit a market; `lib/catalog.ts` gained the label/class/order helpers.
- verified: `npm run verify` green (73 tests; `tests/catalog.test.ts` now 7). e2e on :3001 — manager sees table + note + guardrails and "Add market"; executive sees the same content but no add/edit. Direct RLS probe: executive `market` insert blocked by `market_write`, manager insert ok (cleaned up).
- notes: the guardrails card is static copy faithful to the mock for now — T3.4 will make send window / cap / required-before-sending stored per market and read by T7.4 pre-send checks. Company counts come through the user client, so an executive sees counts only for their own markets (data boundary) while the market rows themselves are readable by all.
- surprises: none blocking. `market.priority`/`market.status` are nullable in the DB types (defaults only apply on insert), so the page coerces them to `medium`/`active` before handing them to the client.

---

### T3.4 — market guardrails stored per market
- when: 2026-09-18 19:30 UTC
- agent: opencode
- files: supabase/migrations/0005_market_guardrails.sql, lib/database.types.ts (regen), scripts/seed.ts, lib/catalog.ts, lib/market-actions.ts, components/MarketModal.tsx, components/MarketsScreen.tsx, tests/catalog.test.ts
- done: migration `0005_market_guardrails.sql` adds `required_before_sending text` and `legal_note text` to `market` (send window and weekly cap already existed from 0001), applied via `supabase db push`; types regenerated. Seed now populates both new fields per market (jurisdiction-specific legal notes: KVKK, GDPR, APPI, UK GDPR, UAE PDPL, LGPD, Egyptian PDPL). `lib/catalog.ts` gained `marketGuardrails()` + `DEFAULT_SEND_WINDOW`/`DEFAULT_REQUIRED_BEFORE_SENDING`/`DEFAULT_LEGAL_NOTE` — one helper the card and the future T7.4 pre-send checks both read, so an empty guardrail fails closed to safe defaults. `/markets` guardrails card now renders stored values; `MarketModal` + `saveMarket` edit send window, cap, required-before-sending, and legal note.
- verified: `npm run verify` green (76 tests; `tests/catalog.test.ts` now 10). e2e on :3001 — stored send windows and per-jurisdiction legal notes render for each market.
- notes: the "read by T7.4 pre-send checks" half of this task is deferred to T7.4 by design — the storage + shared `marketGuardrails()` helper is the deliverable now.
- surprises: none.

---

## Handoff

**Status:** T3.4 complete. `npm run verify` green (76 tests). **Phase 3 (Catalog) is now complete (4/4).**

- Last completed task: T3.4
- Current task: none open — next is T4.1 (`/companies` table with the mock's five filters, fit score bars, gap counts. RLS scopes executives to their markets automatically — verify by switching user).
- Blocked on: nothing technical.
- Discovered vs PLAN.md (see T3.1–T3.4 log entries for detail):
  - Seed `seedCatalog` silently failed to insert products since Phase 1 (`product.name` not unique → `onConflict:'name'` upsert errored, ignored). Fixed; catalog writes now throw.
  - `lib/ai/context.ts` reserved-key list was incomplete (missing samples, distributor_appointment, technical_compliance, rebate) and the product allowlist was untestable. Both fixed; `RESERVED_MATTERS` is now the single source of truth in `lib/guardrails.ts`.
  - `market.priority`/`market.status` are nullable in generated types (DB defaults don't set the type); the `/markets` page coerces to `medium`/`active`.
  - Market guardrails (`required_before_sending`, `legal_note`) now live on `market` (0005); `marketGuardrails()` in `lib/catalog.ts` is the shared fail-closed reader for both the card and the future T7.4 pre-send checks.
- Operational notes (unchanged): do NOT run `npm run build` while `npm run dev` is running (clobbers `.next`). `npm run seed` does not load `.env.local`; use `npx tsx --env-file=.env.local scripts/seed.ts --reset`.
- Commit status: changes not yet committed — awaiting explicit user go-ahead per repo policy.
- Next command for the next agent:

```
npm run verify
npm run dev
```

Then start T4.1 (the `/companies` list).
