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
`████████████████████░░░░░░░░░░` **68%** — 53 of 78 tasks complete

| Phase | Done | Total |
|---|---|---|
| 0 · Human setup | 5 | 6 |
| 1 · Foundation | 10 | 10 ✓ |
| 2 · Auth & shell | 5 | 5 ✓ |
| 3 · Catalog | 4 | 4 ✓ |
| 4 · Companies & research | 7 | 7 ✓ |
| 5 · AI research pack | 6 | 6 ✓ |
| 6 · Decision-makers | 4 | 4 ✓ |
| 7 · Drafting & review | 7 | 7 ✓ |
| 8 · Gmail connector | 5 | 5 ✓ |
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

### T5.1–T5.6 — AI research pack: client/prompt fixes, research modal, recommendation/fit-score/gaps panels, prioritisation, disqualify+suppression
- when: 2026-09-18 20:20 UTC
- agent: claude-code
- files: supabase/migrations/0007_research_pack.sql, supabase/migrations/0008_research_run_write.sql, lib/database.types.ts (regen), lib/ai/prompts/research.ts, lib/research.ts, lib/research-actions.ts, lib/audit.ts, lib/session.ts, components/CompanyDetailScreen.tsx, app/(app)/companies/[id]/page.tsx, tests/research.test.ts
- done: |
    T5.1/T5.2 were pre-written per PLAN's table but broken in practice — see surprises.
    Bumped `research.ts` to prompt version v2 with an explicit field-by-field JSON shape
    in the system prompt and `maxTokens: 6000`.

    New migrations: `research_run` (one row per research call: summary,
    opportunity_summary, gaps, score, breakdown, suitability, priority_reason,
    decision_maker, linked to ai_run) with a read policy scoped by `company_visible`
    and a write policy for `can_write()` users (not service-role-only, unlike ai_run —
    see the migration's own comment for why). `company` gained `priority_override` +
    `priority_override_reason` (T5.5).

    `lib/research.ts` (pure, tested): `breakdownBarClass`, a criterion-text → canonical
    qualification-fact-key mapper (`criterionKeyFor`/`factsFromBreakdown`), the
    prioritisation ranking (`isRankable`/`computeRank`/`displayRank`), and the
    `RESEARCH_DEPTHS`/`DISQUALIFY_REASONS` constants (kept out of the server-action file
    on purpose — see surprises).

    `lib/research-actions.ts`: `runResearch` (T5.1–T5.4) builds context via
    `buildCompanyContext(..., {includeUnverified:true})` + `buildProductContext`, calls
    the research prompt, writes `research_run`, updates `company.fit_score`, and upserts
    `ai`-provenance qualification-criterion facts from the breakdown — skipping any
    criterion already `verified`/`human_approved` so a research re-run can never
    overwrite a person's confirmed answer. `createTask` (T5.4 "Make a task"),
    `overridePriority` (T5.5, manager-only, mandatory reason → `AUDIT.PRIORITY_OVERRIDDEN`),
    `disqualifyCompany` (T5.6: stage → disqualified + reason, optional domain →
    `suppression` insert, both audited).

    `CompanyDetailScreen.tsx`: header gained Re-run/Run AI research, Nurture,
    Disqualify (previously absent — Phase 4 had no header actions at all). Overview
    gained the AI opportunity-summary block, Recommendation card (Accept and
    advance/Needs more research/Nurture instead/Disqualify, all wired to real actions,
    gated by the existing T4.7 stage-gate logic), Fit score card with per-criterion
    bars, Missing information card with Make a task/Not needed. Qualification tab
    gained the real Suitability aiblock and a Priority card (rank display +
    manager-only override form).
- verified: |
    `npm run verify` green (109 tests, `tests/research.test.ts` = 13). `npm run build`
    clean, all 17 routes. Real e2e against the live Supabase project and the configured
    DeepSeek endpoint (not mocked): ran actual AI research on Kyoto Green Materials
    (manager session) — got a schema-valid response, `research_run` + `fit_score` +
    qualification-criterion `fact` upserts all landed, `ai_cannot_be_confirmed` still
    blocks an AI fact with `confirmed_by` set, and the pre-existing `verified`
    `certification_match` fact was correctly left untouched. Separately verified
    `createTask`/`overridePriority`/`disqualifyCompany`/suppression writes against a
    disposable company (hard-deleted via admin afterward — there is no user-facing
    company delete). Browser e2e (Chrome, real login) as manager: research panels
    render with live data, "Accept and advance" is `disabled` while criteria are
    unverified (confirmed via DOM, not just visual), "Make a task" created a real row,
    priority override round-tripped ("Ranked #2 of 5 … (manually overridden)" with the
    reason shown). As executive (Nusrat): identical panels, but no "Override priority"
    control, and her ranking denominator was "of 2" (her market-scoped view), not
    rifat's "of 5" — confirms the ranking query deliberately runs through the acting
    user's own RLS-scoped client rather than admin, so it can never leak a
    cross-market company count to an executive.
- notes: |
    Ranking is computed live (fit score desc, id tie-break) among same-`product_id`
    companies visible to the acting user — not stored — so it always reflects the
    latest scores and each user's own market scope. `priority_override` is a display
    override only, shown alongside the computed rank's total.

    Qualification-criterion auto-population only fires for the 5 of 6 canonical
    criteria the research prompt's SCORING section actually scores (imports_category,
    buys_south_asia, volume_fit, certification_match, decision_maker_found) and only
    when `awarded > 0` (a zero means "no evidence," which is a gap, not a fact).
    `credit_signal` (payment history) is not one of the prompt's five scored criteria
    and Market priority describes the market, not the company — both stay unpopulated
    until a later phase or a person researches them by hand.

    Deliberately did not touch `scripts/seed.ts` — Phase 5 is additive UI/AI plumbing
    on top of the existing seed, not new demo data. Running real research on a seeded
    company overwrites its static seed `fit_score` with the AI's actual (evidence-based)
    assessment — Kyoto went 78 → 20, which is the system working as designed (the seed
    value was never AI-derived), but worth knowing before a demo: the first research
    run on a thin-evidence company can look like a regression when it is not.
- surprises: |
    **T5.1/T5.2's "pre-written, already reviewed" files did not actually work.**
    `lib/ai/prompts/research.ts`'s system prompt described the scoring rules in prose
    but never told the model the JSON field names — DeepSeek (the configured
    "drafting" model, `deepseek-v4-pro`) returned a differently-shaped, differently-named
    JSON object every time, which `schema.parse` correctly rejected. Fixed by putting
    the exact field-by-field shape in the OUTPUT section.

    **`deepseek-v4-pro` is a reasoning model.** It emits a `thinking` content block
    (`res.content` type `"thinking"`, already correctly filtered out by
    `lib/ai/client.ts`'s `.filter(b => b.type === 'text')`) before the `text` block, and
    that thinking block competes with the JSON for the same `max_tokens` budget. At the
    pre-written `maxTokens: 2500` the whole budget was sometimes spent on thinking alone
    (`stop_reason: 'max_tokens'`, zero-length text block) or truncated the JSON mid-object.
    Raised to `6000` and confirmed `stop_reason: 'end_turn'` with a complete response on
    the real (longer) company context. This will very likely bite `draft.ts` and
    `followup.ts` too when T7/T7.7 build against them — same tier, same model, same
    problem shape. Worth checking their `maxTokens` before assuming they work.

    **A `'use server'` file may only export async functions.** The first draft of
    `lib/research-actions.ts` also exported `RESEARCH_DEPTHS`/`DISQUALIFY_REASONS`
    (plain constants, for the modal's `<select>` options) — this is a Next.js build
    error, not a lint warning, and it only surfaced at runtime (`npm run build` did not
    catch it; a real browser click did, via `read_console_messages`). Fixed by moving
    every non-function export into `lib/research.ts`. Worth remembering for T7/T8/T9's
    server-action files: constants and types go in a plain lib module, never in the
    `'use server'` file itself, even if it feels natural to co-locate them with the
    action that uses them.
- rank_helper_ownership: `lib/research.ts#computeRank` takes an already-fetched,
  already-RLS-scoped company list — deliberately dumb/pure so it stays unit-testable;
  the RLS scoping happens once, in the page/action that calls it.

---

### T6.1–T6.4 — Decision-makers: /contacts list, Add contact + set-primary, AI decision-maker panel, contact stage gate
- when: 2026-09-18 20:35 UTC
- agent: claude-code
- files: supabase/migrations/0009_contact_gate.sql, lib/contacts.ts, lib/contact-actions.ts, lib/audit.ts, app/(app)/contacts/page.tsx, components/ContactsScreen.tsx, components/CompanyDetailScreen.tsx, app/(app)/companies/[id]/page.tsx, tests/contacts.test.ts
- done: |
    T6.4's SQL rule was written first since T6.1–T6.3 both depend on knowing what "a
    named contact" means: `enforce_stage_gate()` (0001, already extended by 0002/0004/0005's
    `create or replace function` pattern) gained a second check — advancing into any of
    outreach/follow_up/reply/meeting/commercial_discussion now requires at least one
    `contact` row with both `email` and `email_source` set. Deliberately does not gate
    entering `contact_identification` itself. `lib/contacts.ts` mirrors this client-side
    (`hasNamedContact`/`contactGateBlocks`/`contactGateReason`) so the Advance button is
    disabled with a reason before the DB ever has to refuse it — same pattern as T4.7's
    qualification gate, and `CompanyDetailScreen`'s `blocked`/`StageControl` now combine
    both gates into one `blockReasons: string[]` list rather than the qualification gate
    alone.

    T6.1 `/contacts`: every contact visible to the signed-in user (RLS scopes executives
    to their markets automatically, same as `/companies`), joined to company/market, with
    provenance badge, lawful basis, a derived "Contactable" column
    (`contactableStatus`: suppressed > nurture-only > unverified-blocked > yes), and
    "last touch" as the max of that contact's `message.created_at`/`reply.received_at`,
    rendered as relative time (`relativeTime`).

    T6.2 Decision-makers tab (`PeoplePane`, previously read-only): `Add contact` modal
    (`ContactModal` + `addContact` action) — an address is stored `verified` only when
    both an email and a real source are given (not "Guessed pattern — unverified"),
    otherwise `unverified`, mirroring the mock's "stored as unverified until checked"
    copy. `Use` button (`setPrimaryContact`) clears every other contact's `is_primary`
    on that company, then sets the target — no DB transaction available via supabase-js
    for a plain two-statement update, so this is sequential like every other multi-step
    write in this codebase (e.g. T5.6's disqualify-then-suppress).

    T6.3 `DecisionMakerCard`: reads `research_run.decision_maker` (already stored by
    Phase 5's research call, just not selected/exposed until now — added to the
    `research_run` select in `app/(app)/companies/[id]/page.tsx` and to `ResearchView`).
    Matches the AI's named pick to an actual `contact` row by name
    (`findContactByName`, case/whitespace-insensitive) and offers `Select as primary`
    only when a match exists and isn't already primary.
- verified: |
    `npm run verify` green (122 tests; `tests/contacts.test.ts` = 13). `npm run build`
    clean, all 17 routes (`/contacts` now real, 2.27 kB). Real e2e against the live
    Supabase project, both via a direct RLS-scoped script and a real browser session
    (manager + executive logins):
    - T6.4 gate: advancing a fresh company past `contact_identification` with zero
      contacts → refused with the exact trigger message; with a contact that has no
      email/source → still refused; with a real named contact → succeeds. Confirmed
      both via a direct DB probe AND in the browser (`Advance to Outreach` `disabled`
      via DOM before adding a contact, `disabled: false` after — on Hansa Agrar Handel,
      a real seeded company at `contact_identification` with no contacts).
    - T6.2: added a real contact through the actual modal, got `Verified` provenance
      (real source given), clicked `Use` — primary flag moved correctly, and the
      Decision-maker AI card's `Select as primary` button appeared/disappeared exactly
      as it should as the matched contact's primary status changed.
    - T6.1: `/contacts` as manager (Rifat) showed all 10 contacts across markets,
      correct badges (`Nurture only` for Verde's contact, `Blocked — unverified` for
      the two unverified ones, real relative "last touch" for the two contacts with
      actual message/reply rows); as executive (Nusrat) showed exactly her 3
      market-scoped contacts — RLS did the scoping with zero app-level filtering code.
    - RLS: an executive outside a company's market sees zero of its contacts, confirmed
      by direct query.
    Both companies used for live browser testing (Kyoto, Hansa) were restored to their
    original seeded contacts/stage afterward via the admin client.
- notes: |
    "Contactable" precedence is suppressed > nurture-only > unverified > yes — a
    suppressed address is blocked even for an otherwise-verified contact at a
    non-nurture company, since "no further contact" (T9.6, not yet built) must win over
    everything once it exists; the check is already wired in `isSuppressed` for when
    that phase adds the suppression flow.
    Did not build a company-selector variant of the Add-contact modal for `/contacts`
    itself — PLAN assigns "Add contact modal" specifically to T6.2 (the company page),
    and the mock's top-of-list "Add contact" button doesn't correspond to any modal
    field for choosing a company either. `/contacts` stays a read-only list, as PLAN's
    T6.1 wording (list only) says.
- surprises: none — T6.1/T6.2/T6.3's dependencies (contact schema, RLS, `research_run.decision_maker`)
    were already correct from Phases 1 and 5; this phase was pure application logic with
    no broken pre-written files to fix, unlike Phase 5.

---

### T7.1–T7.7 — drafting, guardrails, review queue, commercial release, follow-up cadence
- when: 2026-09-18 21:16 UTC
- agent: claude-code
- files: supabase/migrations/0010_message_claims.sql, lib/database.types.ts (regen), lib/ai/prompts/draft.ts, lib/ai/prompts/followup.ts, lib/ai/draft-runner.ts, lib/messages.ts, lib/message-actions.ts, app/globals.css, app/(app)/review/page.tsx, components/ReviewScreen.tsx, components/CompanyDetailScreen.tsx, tests/messages.test.ts
- done: |
    Confirmed the Handoff's prediction: `draft.ts`/`followup.ts` had the exact same two
    bugs T5.1–T5.6 found and fixed in `research.ts` (no JSON shape in the OUTPUT
    section; `maxTokens` too low for `deepseek-v4-pro`'s `thinking` block). Fixed both
    to v2 with an explicit schema and `maxTokens: 6000`, verified against the real
    model before building anything on top (see T5's lesson — cheap insurance).

    Worked out the message state machine from the schema's RLS/CHECK constraints
    before writing code (documented at the top of `lib/messages.ts`): a draft is
    inserted by `lib/ai/draft-runner.ts` (service role, like ai_run/research_run — the
    third file alongside `client.ts`/`context.ts` that `admin.ts`'s header already
    names as a deliberate exception) as `awaiting_approval` or, if the guardrail finds
    something, directly as `held_commercial` — RLS's `message_insert` policy doesn't
    even allow a *user* client to insert that status, so it can only happen this way.
    From there: any write role can approve (manager/commercial) or reject; only a
    commercial-role user can write `released_by` onto a `held_commercial` row (RLS);
    the DB's `held_needs_release` CHECK — not RLS — is what actually stops a manager
    from approving a released-but-still-reserved draft without that release. Editing a
    draft re-runs the pattern-only guardrail pass and can clear a hold back to
    `awaiting_approval` for any write role (nothing reserved is left once it's gone);
    introducing new reserved language via edit is refused at the app level for anyone
    but commercial, rather than let RLS reject it confusingly.

    `lib/ai/draft-runner.ts`: `generateFirstTouch` refuses before any AI call if the
    company has zero verified facts (see surprises — this is a product rule, not just
    a token-budget one) or no verified primary contact, and refuses a second first-touch
    for the same company. `generateFollowup` uses `nextTouchNumber` (stops on any reply,
    caps at touch 3) and does NOT hard-block on the cadence due-date — that's shown as
    information in the Send plan card, not enforced, so a reviewer can draft ahead of
    time. `opens` is hardcoded to 0 (no open-tracking exists — see notes).

    `lib/messages.ts` (pure, tested — 28 tests): word limits by touch, working-day
    cadence (`addWorkingDays`/`cadenceFor`), the nine pre-send checks
    (`buildPreSendChecks`), a market `send_window` text parser that fails OPEN when
    unparseable (an operational courtesy check, not one of AGENTS.md's absolute
    rules), the recipient allowlist predicate, claim/risk highlighting
    (`highlightSegments` — risk spans come from the guardrail's own exact offsets and
    always win on overlap; claim spans are best-effort `indexOf` since the model's
    `claim` text is a paraphrase, not guaranteed verbatim), approximate claim-to-fact
    resolution (`claimIsResolved`, deliberately over-catching per the codebase's
    established guardrail philosophy), and `sha256` for the approval hash.

    `/review`: real waiting list + detail pane, live-computed pre-send checks (not
    stored — always reflects current fact/suppression/cadence state), inline
    claim/risk highlighting in the actual email body, edit/approve/reject/request-changes,
    and — for a held draft — a Commercial guardrail card with Release, visible only to
    `canReleaseCommercial`. `CompanyDetailScreen`'s header gained a "Draft outreach"
    button (`draftOutreach`) that tries `generateFirstTouch` first and falls back to
    `generateFollowup` on "already exists", so one button serves both cases per company.
- verified: |
    `npm run verify` green (150 tests; `tests/messages.test.ts` = 28). `npm run build`
    clean, all 17 routes (`/review` now real, 3.51 kB). Real e2e against the live
    Supabase project and the configured DeepSeek endpoint — no part of the state
    machine was taken on faith:
    - Zero-verified-facts refusal fires before any AI call (Osaka Agri Textiles).
    - A real first-touch draft generated end-to-end for Kyoto Green Materials (6
      claims, correct schema) landed as `awaiting_approval` on one run and, on a
      separate real run through the actual "Draft outreach" button in the browser,
      landed `held_commercial` on `technical_compliance` — the model wrote "certified
      to OEKO-TEX and ISO 9001", which the guardrail's deliberately-over-catching
      pattern for compliance claims correctly flagged even though stating a held
      certification is allowed; this is the system working as documented, and the
      commercial-release flow exists exactly for this case.
    - Re-drafting a company with an existing first-touch refuses; drafting a follow-up
      for a company with a real reply (Yıldız, from seed) refuses with "has replied".
    - RLS role gating, all confirmed by attempted writes, not just reasoning:
      executive cannot approve (message_update RLS), executive cannot release a held
      draft (0 rows affected), manager cannot approve a held-but-unreleased draft (DB
      `held_needs_release` CHECK fires), commercial can release, manager can then
      approve. Reject confirmed via direct RLS-scoped write.
    - Browser session (real login, real clicks) as manager then commercial: the
      "Draft outreach" button shows a pending state through a genuinely slow
      (~40s) reasoning-model call, the review queue renders a REAL pre-existing
      seeded draft (NordFiber, from `scripts/seed.ts`'s deliberately-reserved sample
      offer) with the "sample" sentence correctly highlighted red and Approve
      correctly `disabled` (DOM-checked) while checks block; switching to commercial
      and clicking "Release for approval" persisted `released_by` and the UI updated
      the guardrail card and the "No reserved commercial matter" check live.
    - Found and fixed a real gap this way: the pre-send check list didn't know about
      release, so a commercial user who had just released a draft still saw "No
      reserved commercial matter" as blocking. Fixed `buildPreSendChecks` to treat
      `guardrailClear || released` as passing — the release IS the authorisation.
    Both test companies (Kyoto, and the disposable Osaka check) were left clean or
    restored — no seed data was permanently altered.
- notes: |
    T7.5's "diff of human edits vs AI version kept" is satisfied at the data layer —
    `ai_body` and `human_body` are both stored and neither is ever overwritten — but no
    line-by-line diff view was built in the UI. Worth adding if a future phase's demo
    journey calls for seeing the diff rendered, not just the two texts.

    `assertNotSelfApproval` (lib/session.ts, pre-written for this phase) was
    deliberately not wired in — every draft is AI-authored, not human-authored, and
    the function's `draftedBy` parameter has no clean mapping onto that (the `message`
    table has no "drafted by a person" column). If a future phase adds human-authored
    drafts, this is where separation-of-duties should be enforced.

    No `opens` tracking exists anywhere in the schema, so `followupUserMessage`'s
    `opens` argument is hardcoded to 0. Real open tracking would need either a Gmail
    read-receipt signal (T8) or a tracking pixel, neither of which exists yet — the
    model still writes a reasonable follow-up without it, just without that one
    signal.

    `/outreach` ("Sent & follow-ups") was NOT built — PLAN's Phase 7 task list has no
    task that owns it (T7.3 is specifically the review *queue*, not a sent-history
    log), so it stays a placeholder. Likely belongs to Phase 10 or is implied by T8.3;
    flagging so it isn't assumed done.
- surprises: |
    Confirmed the Handoff's prediction from the last entry: `draft.ts` and
    `followup.ts` had the identical missing-JSON-schema and too-low-`maxTokens` bugs
    `research.ts` had. Same fix shape both times (explicit field-by-field OUTPUT
    section, `maxTokens: 6000`). This is now 3 for 3 on the "drafting" tier's prompts
    needing this fix — `triage.ts` (T9.1, "classify" tier, a non-reasoning model per
    the client.ts rate table) is the one prompt file left unverified; worth checking
    on sight rather than assuming it's fine because it's a different tier.

    A genuinely new finding, not predicted: drafting from a company with **zero**
    verified facts doesn't just risk truncation (which the token bump already
    guards against) — it makes deepseek-v4-pro spend its entire thinking budget
    with NO output at all (`stop_reason: 'max_tokens'`, zero-length text block),
    reproduced directly against the real API. Added a pre-flight refusal
    (`context.facts.length === 0`) in `generateFirstTouch` rather than relying on the
    token budget alone — this is also just correct product behaviour: the EVIDENCE
    RULE means there is nothing to personalise with anyway.

---

### T8.1–T8.5 — Gmail connector: OAuth connect/callback/disconnect, wired approve→draft, Settings→Connectors
- when: 2026-09-18 21:43 UTC
- agent: claude-code
- files: lib/gmail.ts, app/api/auth/gmail/connect/route.ts, app/api/auth/gmail/callback/route.ts, lib/gmail-actions.ts, lib/message-actions.ts, lib/nav.ts, tests/nav.test.ts, app/(app)/settings/page.tsx, components/SettingsScreen.tsx, app/(app)/review/page.tsx, components/ReviewScreen.tsx
- done: |
    T8.2 was already done — `lib/gmail.ts` (pre-written, T5-era) already had
    `createDraft`, `assertComposeOnly`, `assertAllowedRecipient`, `assertNotSuppressed`,
    all asserted before any network call, all tested (`tests/gmail-safety.test.ts`, 9
    tests, unchanged). Extended it (didn't rewrite) with `getConnectionStatus` (reads
    `gmail_token` via the service role — RLS has zero policies on that table, so
    nothing else can — and returns only safe metadata, never the refresh token) and
    `disconnectToken` (best-effort Google-side revoke, wrapped so a dead/invalid token
    can't block removing our own copy, then always deletes the row).

    T8.1: `/api/auth/gmail/connect` (redirects to `consentUrl(user.id)` — state carries
    the signed-in user's own profile id) and `/api/auth/gmail/callback` (re-checks
    `state === currentUser().id` against the still-live session rather than trusting
    the query param, handles Google's `?error=` denial, and any `storeTokenFromCode`
    failure, all by redirecting back to Settings with a readable message).
    `lib/gmail-actions.ts#disconnectGmail` lets a signed-in user remove their own
    connection — no extra role check needed, since disconnecting your own token is
    always yours to do.

    T8.3 — the interesting part: Gmail draft creation belongs in the *approver's own*
    mailbox, which is both the mock's stated design ("Per-user tokens... drafts appear
    in the approver's own mailbox") and, it turns out, exactly what `message_update`'s
    RLS "approving" branch already requires — that branch's WITH CHECK needs
    `approved_by = auth.uid()` on the *resulting* row, and a gmail_draft_id-only update
    still has to satisfy it, so only the original approver's client can legally write
    it. `attemptGmailDraft` (private helper in `lib/message-actions.ts`, shared by
    `approveMessage` and the new `retryGmailDraft`) never throws — a connector failure
    writes `AUDIT.GMAIL_FAILED` and returns a warning string instead, so the human
    approval that already happened is never rolled back by an unrelated mail-API
    hiccup. `/review` gained an "Approved, awaiting a Gmail draft" card (visible to
    approvers) listing every approved-but-undrafted message with its last error and a
    Retry button — shown only to the original approver; anyone else sees who can retry
    and why.

    T8.4: `/settings` is real now (was a T11.2 placeholder). Built the full 5-tab shell
    but only implemented Connectors — the other four tabs (Users & roles, Scoring, AI
    workflow, Commercial guardrails) are explicitly Phase 11's and show a one-line
    "arrives in Phase 11" placeholder rather than fabricated content. Connectors shows
    only what's real in this build: Gmail (live OAuth status, Connect/Reauthorise/
    Disconnect) and Outbound sending (statically Off/Locked, matching
    `ENABLE_OUTBOUND_SEND=false`) — did NOT fabricate the mock's Registry
    lookup/UN Comtrade/Calendar rows, since none of those are real connectors in this
    architecture (see AGENTS.md's decisions table — research runs on AI reasoning over
    stored facts, not live registry APIs).

    Discovered and fixed a real access-control gap while building this: `lib/nav.ts`
    hid "Settings & access" from everyone but managers (a T2.4 decision, aimed at
    Users & roles), which meant Mahbub (commercial) — who legitimately needs to
    connect his own Gmail, since he approves released drafts — had no way to reach the
    Connectors tab at all. Widened the nav role list to `['manager', 'commercial']`
    and narrowed the *page* itself: commercial sees only the Connectors content (no
    tab bar, since it's their only tab); the other four tabs still render
    manager-only. Added a test asserting commercial sees the nav item; the two
    existing tests (executive/auditor still hidden) needed no change.
- verified: |
    `npm run verify` green (151 tests). `npm run build` clean, 19 routes now (was 17)
    — the two new `/api/auth/gmail/*` routes plus `/settings` and `/review` both real.
    Real e2e against the live Supabase project, the real Google OAuth client from
    `.env.local`, and a real browser session across three roles:
    - `consentUrl()` produces a correct, well-formed URL (verified by parsing it in a
      script: right `client_id`, `redirect_uri` matching `.env.local` exactly, both
      scopes, `state` equal to the caller's own profile id, `access_type=offline`,
      `prompt=consent`) — AND by actually clicking "Connect" in the browser and
      confirming the tab landed on a real `accounts.google.com` sign-in/consent page
      with every one of those same parameters present in the live URL.
    - `getConnectionStatus`/`disconnectToken` round-tripped for real: inserted a
      token row, confirmed `connected: true` with the right metadata; disconnected,
      confirmed `connected: false`; confirmed `disconnectToken` does not throw when
      the stored refresh token is garbage (Google's revoke call fails, caught,
      row still removed) — same behaviour verified again through the actual Settings
      UI (Connect state → fake-connected via admin to simulate a completed OAuth →
      Disconnect button → back to "Not connected" after refresh).
    - The `compose_only` CHECK constraint on `gmail_token` itself still blocks a
      send-scope token at the DB level regardless of app logic (direct insert
      attempt refused).
    - T8.3's "never a silent drop": approved a real message as Rifat with no Gmail
      connected — the approve succeeded (status stayed `approved`), a
      `AUDIT.GMAIL_FAILED` row was written with a readable reason, and the message
      appeared in the new "Approved, awaiting a Gmail draft" card with that same
      reason and a Retry button. Clicking Retry reproduced the identical graceful
      error, not a crash. Switching to Mahbub (commercial, also `canApprove`) showed
      the same card entry but *no* Retry button — "Only Rifat Hasan can retry — it
      goes into their mailbox" instead, confirming the per-approver ownership rule.
    - Settings role gating: manager sees all 5 tabs; commercial sees Connectors alone
      (confirmed — no tab bar rendered); executive is blocked both in the nav (item
      absent) and at the page level (direct navigation to `/settings` shows the
      "available to managers and the Commercial Authority" message, not the page).
    Every company/message/contact/token used for this testing was deleted or reverted
    via the admin client afterward — no seed data was permanently altered.
- notes: |
    **What is still genuinely unverified, and why:** the actual `code` → token
    exchange after a human completes Google's real consent screen. I reached the edge
    of what's possible without your Google account: I confirmed the redirect lands on
    a correct, live `accounts.google.com` page with exactly the right parameters, and
    I confirmed every downstream piece of code (`storeTokenFromCode`, the callback's
    error handling, `getConnectionStatus`, the whole approve→draft→retry chain) works
    correctly given *a* token, real or simulated — but I did not and could not click
    through the actual consent screen myself. If you complete that once, everything
    downstream of it is already proven to work.

    `lib/gmail.ts`'s `createDraft()` itself (the actual `gmail.users.drafts.create`
    call) was not exercised against a real Gmail account for the same reason — it was
    already unit-tested for its pre-conditions (T8.2, pre-existing) and its call site
    (`attemptGmailDraft`) was proven correct against the "not connected" branch; the
    "successfully creates a real draft" branch needs a real connected account to
    confirm, same blocker as above.

    Port 3000 (the registered `GOOGLE_REDIRECT_URI`) was occupied by an unrelated
    Next.js/Turbopack dev server on this machine, not started by me — I did not stop
    it. Ran the verification dev server on 3014 instead; this doesn't affect the
    `/connect` redirect itself (which correctly points at port 3000 regardless of
    what port serves the page that links to it), only that a *real* completed consent
    round trip would need to land on whatever is actually serving port 3000.
- surprises: |
    The RLS analysis wasn't just a nice-to-have this time — it's *why* Gmail drafts
    must be created with the approver's own client rather than, say, the service
    role: `message_update`'s "approving" branch's WITH CHECK genuinely requires
    `approved_by = auth.uid()` on every resulting row, including a bare
    `gmail_draft_id` update on an already-approved row. Using the service role here
    (which would have been simpler) would have silently defeated that ownership
    guarantee. Worth remembering for any future message-table write: check which RLS
    branch a write needs to satisfy, don't assume a "safe" admin write is actually
    the more correct choice.

---

### T8.1 addendum — real OAuth consent round trip completed
- when: 2026-09-18 22:05 UTC
- agent: claude-code + user (the one step only a human could do)
- files: none (verification only, no code changed)
- done: |
    The one gap left open by the T8.1–T8.5 entry above: the user freed port 3000
    (stopped an unrelated dev server for a different project, `D:\Anwar
    TradeReach\traderach`, with explicit go-ahead), TradeReach's dev server was
    started there to match the fixed `GOOGLE_REDIRECT_URI`, and the user completed
    Google's real consent screen as Rifat Hasan.
- verified: |
    `gmail_token` now holds a real refresh token for Rifat (confirmed via
    `getConnectionStatus` — `connected: true`, correct compose+calendar scope,
    real timestamp). Then went one step further than "connected": called
    `createDraft()` for real against this live connection — it genuinely created a
    Gmail draft (`draftId`/`threadId` returned by the real Gmail API) in Rifat's
    actual Drafts folder, addressed to a `.test` recipient, clearly subject-lined as
    a safe-to-delete verification draft. This was the one piece of Phase 8 that
    could not be verified before (createDraft's happy path, as opposed to its
    precondition checks). Phase 8 is now verified end-to-end with no remaining gaps.
- notes: the verification draft was left in place rather than auto-deleted — deleting
    from a real, external mailbox is the kind of action this build asks for
    confirmation before taking, even for something it created itself. The user can
    remove it directly in Gmail, or ask for a delete script.
- surprises: none — every piece of code the earlier entry predicted would work,
    given a real token, did.

---

## Handoff

**Status:** Phase 8 complete (5/5) and now fully verified, including the real OAuth
round trip — `gmail_token` holds a genuine refresh token and `createDraft()` has
created an actual Gmail draft against it. No gaps remain in the Gmail connector.

- Last completed task: T8.1's real-consent verification (addendum above).
- Current task: none open — next is T9.1 (Phase 9, replies and triage).
- Blocked on: nothing. One open item carried from Phase 7, still unresolved:
  `lib/ai/prompts/triage.ts` has not been verified against the real model — check it
  (same way research.ts/draft.ts/followup.ts were checked: a real call, confirm
  `stop_reason: 'end_turn'` not `'max_tokens'`, confirm the JSON shape is actually
  specified in the OUTPUT section) before building T9's triage UI on it. The pattern
  is 3-for-3 on the "drafting" tier; don't assume "classify" tier is fine just
  because it's presumably a non-reasoning model.
- Operational notes (unchanged): do NOT run `npm run build` while `npm run dev` is
  running (clobbers `.next`). `npm run seed` does not load `.env.local`; use
  `npx tsx --env-file=.env.local scripts/seed.ts --reset`. Regenerate
  `lib/database.types.ts` with
  `npx supabase gen types typescript --linked > lib/database.types.ts` (direct bash
  redirect), not `npm run types` (writes UTF-16 on this Windows box). Port 3000 is
  free again as of this session, but another project on this machine may reclaim it
  — check before assuming it's available for a real OAuth round trip.
- Commit status: Phases 2–8 committed. This addendum is uncommitted — awaiting user
  go-ahead.
- Next command for the next agent:

```
npm run verify
npm run dev
```

Then start T9.1 (`lib/ai/prompts/triage.ts` — verify against the real model first,
same as every other prompt file this build has touched).

