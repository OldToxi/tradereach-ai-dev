# TradeReach AI

Export-outreach management for **Anwar Group**. TradeReach researches potential
buyers, drafts first-touch outreach, and manages every reply — with one hard rule
running through it all: **nothing is sent unless a named person approved it, and every
fact can point at where it came from.**

This is a working application (Next.js + Supabase), not a demo mock. The click-through
spec it was built against lives in `design/mock-ui.html`.

The submission checklist (the twelve brief §8 deliverables, with status and pointers) is
in [`DELIVERABLES.md`](DELIVERABLES.md); the recording script for the demo video is in
[`DEMO.md`](DEMO.md).

## Try it live

- **Live app** — https://tradereach-ai-five.vercel.app
- **Demo sign-in** (all passwords `demo-password-2026`):

  | Email | Role |
  |---|---|
  | `rifat.hasan@anwargroup.test` | Export Manager |
  | `nusrat.jahan@anwargroup.test` | Export Executive |
  | `mahbub.rahman@anwargroup.test` | Commercial Authority |
  | `audit@anwargroup.test` | Read-only Auditor |

- **Walkthrough** — [`DEMO.md`](DEMO.md) (the twelve-step journey, with a recording
  script) · **Deliverables** — [`DELIVERABLES.md`](DELIVERABLES.md) · **Assessment
  coverage** — [`ASSESSMENT.md`](ASSESSMENT.md)

---

## What it does

- **Research** — an AI pass reads a company's site and trade data, proposes facts with
  provenance, and returns a fit score. A person promotes AI findings to *verified*.
- **Draft & review** — four AI prompts (research, first-touch, follow-up, triage)
  produce outreach. Every draft sits in a review queue with pre-send checks until a
  named approver signs it off.
- **Commercial guardrail** — price, MOQ, credit, freight, delivery dates, samples,
  exclusivity, distributor appointment, warranty and compliance claims are reserved to
  authorised staff. A draft that touches one is held until a *Commercial Authority*
  releases it.
- **Replies** — incoming mail is read on page load, classified, and routed: answerable
  now, or escalated when it asks for something reserved.
- **Audit** — every approval, promotion, AI run, connector call and access refusal is
  append-only.

---

## Quick start

Human-only setup (Google OAuth, Supabase, Anthropic, Vercel) is documented step by
step in [`SETUP.md`](SETUP.md). It takes about 35 minutes and none of it needs the code
to exist yet.

```bash
cp .env.example .env.local   # fill every value
npm install
npm run dev                  # starts on :3000 (auto-increments if busy)
```

Seed the demo workspace (mid-journey state — a draft that trips the samples guardrail,
and a reply that splits technical/commercial):

```bash
npx tsx --env-file=.env.local scripts/seed.ts --reset
```

Then sign in with any seeded role (all passwords `demo-password-2026`):

| Email | Role |
|---|---|
| `rifat.hasan@anwargroup.test` | Export Manager |
| `nusrat.jahan@anwargroup.test` | Export Executive |
| `mahbub.rahman@anwargroup.test` | Commercial Authority |
| `audit@anwargroup.test` | Read-only Auditor |

`AUTH_MODE=stub` skips login for local development (assumes `DEV_USER`); it throws at
import time if `NODE_ENV=production`.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run verify` | Typecheck + lint + unit tests (the CI gate) |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright twelve-step journey |
| `npm run seed` | Seed the demo workspace |
| `npm run types` | Regenerate `lib/database.types.ts` from the linked Supabase |
| `npm run progress` | Rewrite the progress bar in `WORKLOG.md` |

---

## Architecture

| Area | Decision | Why |
|---|---|---|
| Framework | Next.js App Router + TypeScript | One deployable, server actions, Vercel |
| Styling | Tailwind, tokens from `design/mock-ui.html` `:root` | The mock is the spec |
| DB + Auth | Supabase (Postgres + Auth) | One service for both |
| DB access | `supabase-js` on the server **with the user's JWT** | So row-level security actually fires |
| Prisma | **Not used as a client.** Plain SQL migrations | Prisma's privileged role would bypass RLS |
| Service role | One file, `lib/supabase/admin.ts`, five callers | Auditable boundary |
| AI | Anthropic API (or DeepSeek via its Anthropic-compatible endpoint), server-only, JSON validated with zod | Four prompts total |
| Background work | None — `next_touch_at` computed on read; replies fetched on page load | No queue, no cron |
| Types | `supabase gen types typescript` → `lib/database.types.ts` | Never hand-written |

### Directory layout

```
app/                 route handlers + server pages (App Router)
  (app)/             the authenticated workspace (dashboard, pipeline, review, replies…)
  api/               Gmail OAuth callback/connect, audit export
components/          client screens (ReviewScreen, RepliesScreen, DashboardScreen, …)
lib/                 pure helpers, server actions, AI prompts, Supabase clients
  ai/prompts/        research.ts, draft.ts, followup.ts, triage.ts  ← the four prompts
  supabase/          admin.ts (service role), server.ts (user JWT)
supabase/migrations/ plain SQL — schema, RLS, auth hook, per-phase additions
scripts/             seed.ts, progress.mjs
tests/               Vitest unit tests (source-text + pure-function)
e2e/                 Playwright journey
design/mock-ui.html  the click-through spec
```

### The service-role boundary

`lib/supabase/admin.ts` is the **only** file allowed to read `SUPABASE_SERVICE_ROLE_KEY`.
Its five callers: audit writes, Gmail token read/refresh, the seed script, reply-actions'
read-only commercial-authority lookup (executives cannot read other profiles via RLS),
and user-actions' user administration.

---

## Database overview

Plain SQL migrations in `supabase/migrations/`, applied with `supabase db push` (remote)
or `supabase migration up` (local Docker). The CHECK constraints are the product rules —
they are enforced by Postgres, not application code:

- **Provenance** — a `fact` must carry one of `verified | unverified | ai | human_approved`;
  `verified` requires a `source_id` or `confirmed_by` user.
- **AI is never a fact** — AI-proposed values cannot be marked confirmed.
- **Named approver** — `message.status = 'approved'` requires `approved_by`.
- **Reserved matters** — a draft that touches a reserved matter cannot become `approved`
  without `released_by` (commercial release).

Row-level security (deny-by-default) scopes data by market: an executive reads only
their assigned markets, only manager/commercial can approve, and `gmail_token` is
unreadable by the user client. A Supabase auth hook injects the user's markets as a JWT
claim so RLS can evaluate it.

Roles: `executive`, `manager`, `commercial`, `auditor` (read-only).

---

## AI workflow

Four prompts, each versioned in `lib/ai/prompts/` and validated with zod:

| Prompt | One call returns |
|---|---|
| `research.ts` | `summary, gaps[], score, breakdown[], suitability, priority_reason, decision_maker` |
| `draft.ts` | first-touch `subject, body, why[], claims_used[]` |
| `followup.ts` | touch 2 and 3 — must not repeat touch 1 |
| `triage.ts` | `category, intent, urgency, confidence, reasoning, next_action` |

Every AI call writes an `ai_run` row (model, prompt version, tokens, cost) **before**
returning. Reserved facts are never placed in a prompt's context — a model can't quote a
price it has never seen. Detection still runs on the output, because a model can
volunteer a commitment ("I can arrange a sample this month") unprompted.

---

## Connector integration

- **Gmail** — OAuth scope `gmail.compose` only. TradeReach creates **drafts** in the
  approver's own mailbox; it can never send. Tokens are stored server-side in
  `gmail_token`, unreadable by the user client.
- **Google Calendar** — scope `calendar.events`, for the meetings pipeline.

Demo safety is enforced server-side: recipients must match `ALLOWED_RECIPIENT_PATTERN`
(`%.test` by default), and `ENABLE_OUTBOUND_SEND=false` is a hard off-switch.

---

## The twelve-step demonstration journey

`e2e/twelve-step-journey.spec.ts` walks the whole connected journey from the brief,
opening mid-journey (per `scripts/seed.ts`):

1. Sign in as the Export Manager
2. Dashboard KPIs
3. Open the review queue
4. See the NordFiber draft waiting
5. The samples guardrail highlights the reserved language
6. Approval is blocked by the "No reserved commercial matter" check
7. Open replies
8. Inspect the Yıldız reply — the technical/commercial split
9. It is untriaged, awaiting a next action
10. Browse companies
11. Opportunity pipeline
12. Audit trail

It is read-only and deterministic: it never fires a live AI call or a send.

---

## Testing

- **Unit** (`npm run test`) — pure-function tests plus source-text assertions that pin
  the product rules to the migration SQL (a future edit that loosens a constraint or
  RLS policy fails CI even without a database).
- **End-to-end** (`npm run test:e2e`) — the twelve-step journey, run against a running
  dev server and a seeded Supabase project. Defaults to the system Chrome
  (`channel: 'chrome'`) because the Playwright browser CDN is not always reachable;
  override with `E2E_CHANNEL` / `E2E_BASE_URL`.

`npm run verify` is the gate: typecheck + lint + unit tests.

---

## Completed vs incomplete

**Complete:** research, drafting, review queue, guardrails, replies & triage, meetings,
pipeline, scoring, settings (users, scoring, AI workflow, commercial guardrails),
Gmail + Calendar connectors, audit trail, the products "market fit" panel, the
"sent & follow-ups" outreach screen, and the full test suite (271 unit tests plus the
twelve-step Playwright journey).

**Not yet done (human steps):** the demo video ([`DEMO.md`](DEMO.md)) and adding the
production Gmail callback URL to the Google OAuth client (see [`SETUP.md`](SETUP.md)).
All 80 planned tasks are finished — see [`PLAN.md`](PLAN.md) and [`WORKLOG.md`](WORKLOG.md)
for the live task state.

---

## Known limitations

- **No background worker.** New mail is read on page load and `next_touch_at` is computed
  on read. Correct for this scale, but a cron would be the first upgrade.
- **Single Gmail token per user.** A draft lands in the mailbox of whoever connected it.
- **Existing Gmail tokens predate the `gmail.readonly` scope** and will 403 until the
  user re-runs the OAuth consent.
- **AI is advisory.** Fit scores and next actions are recommendations; only a person
  promotes or approves.
- **OAuth consent is in Google "Testing" status** — see the "unverified app" note in
  `SETUP.md`.

---

## Next steps

1. Record the demonstration video using [`DEMO.md`](DEMO.md).
2. Add the production Gmail callback URL to the Google OAuth client (see `SETUP.md`).
3. Optional: a reply/triage cron, multi-mailbox Gmail support, and Open/read tracking on
   sent messages (the mock's "Opens" column has no schema behind it today).

---

## Third-party disclosure

| Service | Purpose |
|---|---|
| Supabase | Postgres database, auth, row-level security |
| Anthropic (or DeepSeek) | The four AI prompts (research, draft, follow-up, triage) |
| Google (Gmail + Calendar) | Drafts into the approver's mailbox, meeting events |
| Vercel | Hosting |
| Next.js / React / Tailwind / zod | Framework, styling, schema validation |
| Vitest / Playwright | Testing |
