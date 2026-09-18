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
`████████████░░░░░░░░░░░░░░░░░░` **40%** — 31 of 78 tasks complete

| Phase | Done | Total |
|---|---|---|
| 0 · Human setup | 5 | 6 |
| 1 · Foundation | 10 | 10 ✓ |
| 2 · Auth & shell | 5 | 5 ✓ |
| 3 · Catalog | 4 | 4 ✓ |
| 4 · Companies & research | 7 | 7 ✓ |
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

### T4.1 — /companies table + filters + fit-score bars + gap counts
- when: 2026-09-18 19:45 UTC
- agent: opencode
- files: app/(app)/companies/page.tsx, components/CompaniesScreen.tsx, lib/companies.ts, app/globals.css, tests/companies.test.ts
- done: `/companies` server page fetches `company` (owner full_name embedded via `profiles!company_owner_id_fkey`), qualification-criterion `fact`s, primary `contact`s and `market`s through the user JWT, then derives per-company `gapCount` (criterion facts still unverified), `decisionMaker` (primary contact) and `ownerName`. `CompaniesScreen` renders the table (Company / Market / Type / AI fit score with `.bar` band / Data / Stage / Decision-maker / Owner / Next action) with the mock's four filter controls (stage, market, fit-score band, missing-data checkbox) and a "N of M companies shown" count line. New `lib/companies.ts` holds `STAGE_LABELS`, `fitBarClass` (80/60 thresholds), `companyNextAction` (stage-driven) and `dataCell` (missing/complete/not-researched). Added `.bar`/`.score` CSS to globals.css.
- verified: `npm run verify` green (84 tests; `tests/companies.test.ts` = 8). e2e on :3001 switching users — manager sees all 12 companies; executive Nusrat (Japan/UAE) sees exactly 4; executive Tanvir (Brazil/Egypt) sees exactly 2. Owner names, decision-makers, gap tags and fit-score bars all render.
- notes: PLAN says "five filters" but the mock has four controls (stage, market, fit, missing-data); implemented the mock's four. "Next action" is a stable stage-driven fallback (T10.x makes it precise); the "Add company" / "Bulk AI research" / "Export" buttons are deferred to T4.2 / T5.x / T11.1. Gap count = unverified qualification criteria; a company with no criterion facts shows "Not researched" rather than a fabricated "Complete".
- surprises: `profiles` RLS lets managers/commercial/auditors read any profile but executives only their own — so owner names for colleagues would be null for executives. Does not bite in seed data (each executive's visible companies are self-owned) and the page falls back to "—" when null. Worth revisiting when T11.2 reworks Users & roles.

---

### T4.2–T4.7 — company detail: add modal, six-tab detail, overview facts, sources & notes, qualification checklist, stage gate
- when: 2026-09-18 20:05 UTC
- agent: opencode
- files: supabase/migrations/0006_source_supports.sql, lib/database.types.ts (regen), lib/company-facts.ts, lib/company-actions.ts, components/CompanyModal.tsx, components/CompaniesScreen.tsx, components/CompanyDetailScreen.tsx, app/(app)/companies/page.tsx, app/(app)/companies/[id]/page.tsx, scripts/seed.ts, app/globals.css, tests/company-facts.test.ts
- done: |
    T4.2 `CompanyModal` (name/website/market/type/product/owner; "Run AI research" checkbox disabled until T5) + `addCompany` server action (manager/executive/commercial, `company_insert` RLS, `COMPANY_ADDED` audit).
    T4.3 `/companies/[id]` server page (404 when RLS hides the row) + `CompanyDetailScreen` with the mock's six tabs (Overview / Research & sources / Qualification / Decision-makers / Communication / History).
    T4.4 Overview tab renders the company record as fact rows with provenance badges (`provenanceClass`/`provenanceLabel`), promote-to-verified control gated on a chosen source, and a pipeline stage control (`Move to a specific stage` / `Advance to X`) with the qualification gate surfaced.
    T4.5 Research & sources tab: sources table, `Add source` modal (title/url, new `supports` column, quality), analyst notes listed with a human-approved badge + note composer; notes stored as `analyst_note_<ts>` facts and excluded from the Overview kv.
    T4.6 Qualification tab: per-criterion confirm with `CRITERION_CONFIRMED` audit, `N of M confirmed` counter, `qualificationStatus()` derived from the company's own criterion facts.
    T4.7 Stage gate: `gateBlocksAdvance`/`gateReason` mirror the DB `enforce_stage_gate` trigger; `changeStage` surfaces the SQL error reason in the UI. History tab filters audit by `object_type='company' AND object_id=<id>`.
- verified: `npm run verify` green (96 tests, incl. new `tests/company-facts.test.ts` = 12). e2e on :3001 (manager + executive via mailto-auth cookie): yildiz detail 200 with facts, provenance badges, owner, verify controls, "End of the pipeline"; kyoto qualification "1 of 5 confirmed"; RLS — executive nusrat gets 404 on a Türkiye company; direct DB probe — `addCompany`/`addSource`/`addAnalystNote` ok, promote-with-source → `verified`, person-only verify allowed (rule 1), `ai_cannot_be_confirmed` blocks confirming an AI fact, and `enforce_stage_gate` returns "Cannot advance: 4 qualification field(s) are still unverified" for kyoto. Reseeded clean after the probes.
- notes: the six canonical `QUALIFICATION_CRITERIA` act as the vocabulary/empty-state for the checklist, but the live counter and per-criterion confirm run against the company's own `is_qualification_criterion` facts, so non-canonical criterion keys (kyoto's `importer_licence`, `annual_volume`) are handled consistently with the gate. Analyst notes are `human_approved` + `confirmed_by` and never shown in the Overview record. Promote-to-verified requires a source in the action (stricter than the DB rule 1, matching the mock). `canWrite` = `role !== 'auditor'`; auditor sees the tabs read-only (no verify/confirm/stage/source/note controls).
- surprises: `enforce_stage_gate` is `BEFORE UPDATE OF stage`, so a company with ZERO criterion facts can advance past Qualification (nothing is unverified). Left as-is — it matches the letter of T4.7 ("blocked while any qualification fact is unverified") and Phase 5 populates facts before advancement; flagging here for T7/T10 if a "must have all six verified" gate is wanted.

---

## Handoff

**Status:** Phase 4 complete (7/7). `npm run verify` green (96 tests). `/companies` list + full company detail (six tabs, promote-to-verified, sources, analyst notes, qualification checklist, stage gate) are live and RLS-scoped.

- Last completed task: T4.7 (all of T4.2–T4.7 shipped together in one pass).
- Current task: none open — next is T5.1 (Phase 5, AI research pack).
- Blocked on: nothing technical.
- Discovered vs PLAN.md (see T3.1–T4.7 log entries for detail):
  - PLAN says T4.1 has "five filters"; the mock has four. Built the mock's four.
  - `profiles` RLS: executives read only their own profile → colleague owner names are null for them (falls back to "—").
  - `enforce_stage_gate` only counts *unverified* criteria, so a company with zero criterion facts can advance past Qualification. Matches the letter of T4.7; note for T7/T10 if stricter gating is wanted.
  - `source.supports` is a new column (0006) added to capture "what the source supports" from the mock's Add source modal; `source_type` stays null for manual adds.
  - Seed now sets `object_id` on company-scoped audit rows so the detail History tab has demo rows.
- Operational notes (unchanged): do NOT run `npm run build` while `npm run dev` is running (clobbers `.next`). `npm run seed` does not load `.env.local`; use `npx tsx --env-file=.env.local scripts/seed.ts --reset`.
- Commit status: Phase 2–3 committed (`6b9694e`). T4.1–T4.7 changes are uncommitted — awaiting user go-ahead.
- Next command for the next agent:

```
npm run verify
npm run dev
```

Then start T5.1 (AI research pack — one call, six outputs).
