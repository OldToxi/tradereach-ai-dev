# PLAN.md — TradeReach AI build plan

Tasks run top to bottom. Tick a box only when `npm run verify` passes and `WORKLOG.md`
has an entry for it. `npm run progress` reads these checkboxes to draw the bar.

Task ID format: `T<phase>.<n>`. Tasks marked **[parallel-safe]** may be done out of order.

---

## Phase 0 — Human setup (you, not the agent)

Full instructions in `SETUP.md`. Do **0.2 first** — it is the critical path and the most
likely thing to go wrong.

- [x] T0.1 Create empty GitHub repo, clone, drop these files in, `git push`
- [x] T0.2 Google Cloud: project → OAuth consent screen (External, Testing) → add your own
      email as a test user → scope `https://www.googleapis.com/auth/gmail.compose` →
      OAuth client (Web) → redirect URIs for `localhost:3000` and the Vercel URL
- [x] T0.3 Supabase: new project, copy URL, anon key, service role key, DB password
- [x] T0.4 Anthropic console: API key, set a monthly spend cap
- [ ] T0.5 Vercel: import the repo, add every var from `.env.example` to the project
- [x] T0.6 Locally: `cp .env.example .env.local`, fill it, `npm install`

---

## Phase 1 — Foundation

- [x] T1.1 Scaffold Next.js App Router + TypeScript + Tailwind. `npm run verify` script
      (`tsc --noEmit && next lint && vitest run`). Prettier. `.gitignore` covers `.env*.local`
- [x] T1.2 Tailwind theme from `design/mock-ui.html` `:root` — colours, dark mode, the four
      provenance badge styles as components in `components/ui/Provenance.tsx`
- [x] T1.3 Apply `supabase/migrations/0001_schema.sql` (**already written** — see Pre-written files) with `supabase db push`. Add tables if a later task needs them; never loosen a CHECK constraint
      `supabase/migrations/0001_schema.sql` already in this repo; extend, don't rewrite.
      Apply with `supabase db push`
- [x] T1.4 Apply `supabase/migrations/0002_rls.sql` (**already written**) — enable RLS on every table, write policies for
      `company`, `fact`, `contact`, `message`, `source`. `gmail_token` gets RLS and **zero**
      policies. Deny-by-default everywhere
- [x] T1.5 Apply `supabase/migrations/0003_auth_hook.sql` (**already written**) AND enable it in the Supabase dashboard — Authentication → Hooks → Customize Access Token. Do this BEFORE testing T1.4. Custom access token hook copying `role` and `assigned_markets` from `profiles`
      into the JWT `app_metadata`. Verify with a decoded token
- [x] T1.6 `npx supabase gen types typescript --linked > lib/database.types.ts`
- [x] T1.7 `lib/supabase/server.ts` (user client, cookie-bound) and `lib/supabase/admin.ts`
      (service role, with a comment naming its only three legal callers)
- [x] T1.8 Verify `lib/session.ts` (**already written**) — `currentUser()`, role helpers `canApprove()`,
      `canReleaseCommercial()`, `marketsFor()`. Stub mode via `AUTH_MODE=stub` +
      `DEV_USER`, and a hard `throw` if stub is on in production
- [x] T1.9 Run `npm run seed` (**already written**) — port `COMPANIES`, `DETAIL`, `REPLIES`, `AUDIT`, products,
      markets, contacts from the mock's `<script>` block. Four users: rifat (manager),
      nusrat (executive), tanvir (executive), mahbub (commercial), audit (auditor).
      Seeds the mid-journey state the demo needs
- [x] T1.10 Verify `lib/audit.ts` (**already written**) — `writeAudit({actor, event, object, detail})` via the admin
      client. Every later task calls this

---

## Phase 2 — Auth and app shell

- [x] T2.1 `@supabase/ssr` cookie session + `middleware.ts` refresh. Protect all routes
      except `/login`
- [x] T2.2 `/login` — port the mock's sign-in screen. Email + password. Role note under the
      field. Real Supabase auth against the seeded users
- [x] T2.3 App shell: left rail with the mock's exact groups and routes, top bar with search,
      theme toggle, "Add company". Mobile drawer at 860px
- [x] T2.4 Role-aware rail: hide Settings→Users from non-managers, hide approve controls from
      executives. Audit every refused access
- [x] T2.5 Sign out, session expiry, and a visible "signed in as, role" block in the rail foot

---

## Phase 3 — Catalog (what we sell, where)

- [x] T3.1 `/products` list + `Add product` modal. Capability sheet detail view **[parallel-safe]**
- [x] T3.2 Capability sheet is the *only* commercial context an AI prompt may read. Add the
      allowlist in `lib/ai/context.ts` and a test asserting reserved fields never appear
- [x] T3.3 `/markets` list + `Add market` modal + market note detail with provenance badges
- [x] T3.4 Market guardrails: send window, weekly outreach cap, required-before-sending rules.
      Stored per market, read by the pre-send checks in T7.4

---

## Phase 4 — Companies and research

- [x] T4.1 `/companies` table with the mock's five filters, fit score bars, gap counts.
      RLS scopes executives to their markets automatically — verify by switching user
- [x] T4.2 `Add company` modal → creates company + unverified facts
- [x] T4.3 `/companies/[id]` shell with the six tabs from the mock
- [x] T4.4 Overview tab: company record as `fact` rows, each with its provenance badge.
      Promote-to-verified control, gated on a source, writes `confirmed_by` + audit row
- [x] T4.5 Research & sources tab: source table, `Add source` modal, analyst notes stored
      as `human_approved` and never rewritten by AI
- [x] T4.6 Qualification tab: six criteria, per-criterion confirm, `4 of 6 confirmed` counter
- [x] T4.7 Stage gate — advancing past Qualification is blocked while any qualification fact
      is unverified. Enforce in SQL, surface the reason in the UI

---

## Phase 5 — AI research pack (one call, six outputs)

- [x] T5.1 `lib/ai/client.ts` — Anthropic wrapper: model from env, zod-validated JSON,
      retry once on parse failure, always writes an `ai_run` row with tokens and cost
- [x] T5.2 `lib/ai/prompts/research.ts` v2 — returns summary, gaps, score, breakdown,
      suitability, priority reason, decision-maker pick. Context is verified facts only
- [x] T5.3 `Run AI research` modal + server action. Depth options. Writes results as `ai`
      provenance, never `verified`
- [x] T5.4 Render into the mock's panels: opportunity summary, recommendation with
      accept/nurture/disqualify, fit score breakdown bars, missing-information cards with
      `Make a task`
- [x] T5.5 Prioritisation: rank qualified companies, show `#3 of 41`, allow manager override
      with a mandatory reason written to audit
- [x] T5.6 Disqualify modal with reason + optional permanent domain suppression

---

## Phase 6 — Decision-makers

- [x] T6.1 `/contacts` list with verification state, contactable state, lawful basis
- [x] T6.2 Company → Decision-makers tab, `Add contact` modal, set-primary
- [x] T6.3 Decision-maker recommendation panel (from the T5.2 call) with fallback contact
- [x] T6.4 Rule: a company cannot leave Contact identification without a named contact whose
      email has a recorded source. SQL-enforced

---

## Phase 7 — Drafting, guardrails, review queue

- [x] T7.1 `lib/ai/prompts/draft.ts` v1 — returns subject, body, `why[]`, `claims_used[]`.
      Context: verified facts + product capability sheet only
- [x] T7.2 `lib/guardrails.ts` — reserved-matter detection on meaning, not keywords. Returns
      matched matter + the offending sentence. Unit tests including
      "what would a container land at" → pricing
- [x] T7.3 `/review` queue: waiting list, message viewer, claim highlighting
      (`why` = verified claim, `risk` = reserved matter), `Why this message` panel
- [x] T7.4 Pre-send checks panel — nine checks from the mock, each pass/hold, blocking
- [x] T7.5 Approve / request changes / reject. Approve writes `approved_by`, the exact text,
      a hash of it, and an audit row. Diff of human edits vs AI version kept
- [x] T7.6 Commercial release flow: held draft → request release → `commercial` role
      approves → unblocks. Executives cannot self-approve
- [x] T7.7 `lib/ai/prompts/followup.ts` v1 + cadence: touch 2 at +4 working days, touch 3 at
      +11, then nurture. `next_touch_at` computed, follow-ups stop on any reply

---

## Phase 8 — Gmail connector

- [x] T8.1 OAuth flow: connect, callback, refresh token stored in `gmail_token` (RLS on, no
      policies). Reauthorise and revoke
- [x] T8.2 `lib/gmail.ts` — `createDraft()` using `users.drafts.create`. Scope assertion,
      `%.test` recipient assertion, both throwing before any network call
- [x] T8.3 Wire approve → create Gmail draft. Surface the draft ID. Visible error state and
      retry on failure — never a silent drop
- [x] T8.4 Settings → Connectors screen: status per service, reauthorise, rotate, the safety
      rails panel from the mock
- [x] T8.5 Tests: sending is impossible (scope), non-`.test` recipient is refused, connector
      failure surfaces

---

## Phase 9 — Replies and triage

- [x] T9.1 `lib/ai/prompts/triage.ts` v1 — category, intent, urgency, confidence, reasoning,
      next action. Eight categories from the mock
- [x] T9.2 Reply ingestion on page load via Gmail `history.list`, plus the
      `Simulate an incoming reply` modal writing a reply tagged as test data
- [x] T9.3 `/replies` — inbox list, message viewer, classification panel, confidence,
      one-click reclassify that stores the correction
- [x] T9.4 Next-action panel with the five actions: draft response, escalate for pricing,
      book a call, nurture, no further contact
- [x] T9.5 Split handling — a reply containing both an answerable and a reserved request
      produces a technical draft plus a commercial escalation. This is the demo's key moment
- [x] T9.6 Suppression: `no further contact` permanently blocks the address, cannot be undone
      by import or by AI. SQL-enforced, with a test

---

## Phase 10 — Meetings, tasks, pipeline, dashboard

- [x] T10.1 `/meetings` upcoming list + `Schedule meeting` modal + Calendar event creation
- [x] T10.2 AI meeting brief from verified facts and the thread, with the explicit
      "do not commit" list
- [x] T10.3 Tasks: create, assign, due, `blocks stage advancement` flag honoured by the gates
- [x] T10.4 `/pipeline` board: nine stages from the mock, drag between stages where the
      stage rules allow, refusal message where they don't
- [x] T10.5 Holding lanes: needs research, nurturing, awaiting approval, awaiting commercial
      release, disqualified, no further contact, closed
- [x] T10.6 `/dashboard`: six KPI tiles, Needs you today, funnel, market bars, follow-ups due,
      data health counts, connector status. All live queries
- [x] T10.7 Weekly AI read-out on the dashboard, generated on demand, marked unreviewed until
      a human marks it reviewed

---

## Phase 11 — Control surfaces

- [x] T11.1 `/audit` — filterable, paginated, exportable. Append-only proven by a test that
      an update or delete is refused
- [x] T11.2 Settings → Users & roles: team table, invite, role and market assignment
- [x] T11.3 Settings → Scoring: weight sliders, thresholds, recalculation on save, history of
      past scores preserved
- [x] T11.4 Settings → AI workflow: the ten-step table, model settings, spend cap,
      refusals-and-limits panel. Reads real prompt versions
- [x] T11.5 Settings → Commercial guardrails: reserved matters list, add/remove, standard
      refusal template editor

---

## Phase 12 — Tests, docs, deploy

- [x] T12.1 Unit tests: scoring maths, guardrail detection, cadence dates, provenance
      constraint violations
- [x] T12.2 RLS tests: executive cannot read another market, executive cannot approve,
      `gmail_token` unreadable by the user client
- [x] T12.3 Playwright: the twelve-step demonstration journey from brief section 6, end to end
- [ ] T12.4 `README.md`: setup, deployment, architecture, database overview, stack rationale,
      AI workflow, connector integration, completed vs incomplete features, known
      limitations, next steps, third-party disclosure. Brief section 8 is the outline
- [ ] T12.5 Deploy to Vercel, set `AUTH_MODE=live`, smoke-test the journey on the deployed URL
- [ ] T12.6 Final pass: no secrets committed, `.env.example` complete, stub-auth guard verified
      in production build

---

## Pre-written files — do not rewrite from scratch

These ship with the bundle, already reviewed. They are the files most likely to be
subtly wrong if an agent invents them, so they were written first. Extend them; do not
replace them. If one is wrong, fix the specific thing and note it in `WORKLOG.md`
under `surprises`.

| File | Covers tasks | Note |
|---|---|---|
| `supabase/migrations/0001_schema.sql` | T1.3 | The CHECK constraints are the product rules. Add tables, don't loosen constraints. |
| `supabase/migrations/0002_rls.sql` | T1.4 | Deny-by-default. Apply AFTER 0003, or every policy reads false. |
| `supabase/migrations/0003_auth_hook.sql` | T1.5 | Must also be **enabled in the Supabase dashboard**. See the header comment. |
| `lib/supabase/server.ts` | T1.7 | The user client. Almost everything uses this. |
| `lib/supabase/admin.ts` | T1.7 | Service role. Three legal callers, named in the file. |
| `lib/audit.ts` | T1.10 | `AUDIT` constants are the filter vocabulary for T11.1. |
| `scripts/seed.ts` | T1.9 | Seeds the mid-journey demo state. Idempotent, `--reset` available. |
| `lib/session.ts` | T1.8, T2.4 | `requirePermission()` audits refusals. `assertNotSelfApproval()` is used in T7.5. |
| `lib/guardrails.ts` | T7.2 | Two-pass. Pattern pass is authoritative for blocking. Tests are green. |
| `lib/ai/client.ts` | T5.1 | Every call writes an `ai_run` row. Nothing else may call the SDK. |
| `lib/ai/context.ts` | T3.2, T5.2 | The allowlist. Drafting sees verified facts only. |
| `lib/ai/prompts/research.ts` | T5.2 | One call, six AI features. |
| `lib/ai/prompts/draft.ts` | T7.1 | `claimsUsed` drives the review highlighting. |
| `lib/ai/prompts/followup.ts` | T7.7 | `recommendStopping` is a real output — honour it. |
| `lib/ai/prompts/triage.ts` | T9.1, T9.5 | The `answerable` / `reserved` split is the demo's key moment. |
| `lib/gmail.ts` | T8.1–T8.3 | Three assertions before any network call. |
| `tests/guardrails.test.ts` | T7.2 | Must stay green. Loosening a pattern requires adding the case that forced it. |
| `tests/gmail-safety.test.ts` | T8.5 | Proves sending is impossible and non-`.test` recipients are refused. |

Nothing structural is left to guess at. Phase 1 is now mostly *applying* these files rather
than writing them: create the Supabase project, push the three migrations, enable the auth
hook in the dashboard, generate types, run the seed. Then go straight to Phase 2.

The one ordering trap: **apply 0003 and enable the hook before testing 0002.** Policies read
`role` and `markets` from the JWT. Without the hook those claims are absent, every policy
evaluates false, and the app looks entirely broken while being entirely correct.

### Dependencies these files assume

```
npm i @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk googleapis zod
npm i -D typescript vitest @playwright/test tsx
```
