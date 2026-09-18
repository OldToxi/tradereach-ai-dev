# TradeReach AI — assessment

How this project addresses each assessment criterion from the assignment brief.

## 1. Understanding of the export-development problem

The core insight: **export outreach for a group like Anwar is a research-and-trust
problem before it is a sales problem.** The hard parts are not "write more emails":

- **Finding the right buyer, not the obvious one.** Trade directories give names; they do
  not say whether a buyer imports the exact HS code you ship, in a volume matching your
  MOQ, in a market your certifications cover.
- **Trust through verifiability.** A sourcing manager is pitched daily. The differentiator
  is that every claim can point at a source — "you import HS 5307.10, ~3,400 t/yr, per the
  Turkish trade registry" beats "I saw you are a yarn importer".
- **The commercial risk of over-promising.** A junior executive who emails a price or
  promises samples has bound the company. That is why price, MOQ, credit, samples,
  delivery and exclusivity are treated as reserved matters — a governance problem, not a
  feature.
- **Accountability across a team.** Outreach is done by executives, approved by managers,
  with commercial authority separate — how export houses actually divide responsibility.

It is also a **low-volume, high-personalization** business (a few hundred buyers, not tens
of thousands), which drove the decision to have **no background queue** — everything is
computed on read.

## 2. Product and workflow design

The workflow mirrors the real export funnel, each stage with a named owner and a gate:

```
Product + Market → Company → Research → Qualify → Decision-maker → AI draft → Review/Approve → Gmail draft → Reply → Triage → Pipeline/Dashboard
```

- **The mock is the spec** (`design/mock-ui.html`): a full click-through that defines what
  every screen looks like and does before it is coded.
- **Conversations are split by stage** — Review queue (outbound, pre-send), Sent &
  follow-ups (outbound, post-send), Replies (inbound), Meetings & tasks (the long tail).
- **The review queue is a gate, not an inbox.** Every AI draft waits there with pre-send
  checks until a named approver signs off.
- **Next-touch is derived, not scheduled.** `next_touch_at` is computed from message
  history on read — no cron, no queue.

## 3. Quality of company research and qualification

- **Provenance is first-class.** Every fact carries `verified | unverified | ai |
  human_approved`, with source quality graded (primary / secondary / weak). A fact cannot
  exist without provenance — enforced by a Postgres CHECK constraint.
- **AI proposes, people promote.** The research prompt returns facts, a score and a
  breakdown, but an AI-proposed fact can never be marked confirmed.
- **Qualification is scored and explicit** — fit score, priority rank with reason, and a
  disqualify-with-reason path (optionally suppressing future outreach).
- **Decision-maker capture with legal grounding** — email source and lawful basis
  (consent / legitimate interest) recorded.

## 4. Relevance and personalization of outreach

- **Personalization comes from verified facts, not flattery.** The draft prompt receives
  only facts a person has vetted, and returns `claims_used[]` so the reviewer can see which
  facts each sentence leans on.
- **Reserved values are never given to the model.** A price or MOQ is withheld from prompt
  context; detection still runs on the output because a model can volunteer a commitment
  unprompted.
- **Follow-ups are anti-repetition** — instructed not to repeat touch 1, and versioned.
- **Targeting starts upstream** — the market-fit panel ranks markets against a product
  before outreach begins.

## 5. Practical use of AI

**AI is advisory and auditable, never authoritative.**

- **Four prompts, not ten** — research, draft, follow-up, triage — each versioned and
  schema-validated with zod, so malformed output fails loudly.
- **Every call writes an `ai_run` row** (model, prompt version, tokens, cost) before
  returning — cost and quality are measurable per run.
- **AI output is always badged** — machine fact/draft is visually distinct from human.
- **Triage does real work** — splits a reply into technical vs commercial and routes each
  part to the right person.
- **Provider abstraction** — Anthropic-compatible endpoint, so DeepSeek is a config change.

## 6. Connector implementation

- **Gmail, `gmail.compose` scope only** — creates drafts in the approver's mailbox; it
  structurally cannot send. The send is always a human in Gmail.
- **Tokens server-side** in `gmail_token`, unreadable by the client (RLS), refreshed
  through a single service-role boundary.
- **Calendar** (`calendar.events`) feeds the meetings pipeline.
- **Demo safety enforced server-side** — recipients must match `%.test`, and
  `ENABLE_OUTBOUND_SEND=false` is a hard off-switch, both asserted in tests.

## 7. User experience

- Provenance badges everywhere, persistent search, breadcrumbs, role-scoped navigation,
  light/dark theme, keyboard focus, holds together at 380 px.
- **Designed loading / empty / error states** — no silent catches; failures tell the user
  why.
- **Brand-consistent** — recolored to Anwar Group's crimson accent while keeping semantic
  colors distinct (verified green, AI violet, alert red, due/medium amber).

## 8. Commercial controls

- **Reserved matters** (price, payment terms, credit, MOQ, freight, delivery dates,
  samples, exclusivity, distributor appointment, warranty, compliance claims, discounts,
  rebates, contract length) are held until a Commercial Authority releases them — enforced
  in the database, not the UI.
- **Named approver** — `message.status = 'approved'` requires `approved_by` (CHECK).
- **RLS deny-by-default** — executives read only their markets; only manager/commercial
  approve; markets injected as a JWT claim.
- **Append-only audit trail** — approvals, promotions, AI runs, connector calls, access
  refusals.

## 9. Software architecture and code quality

- **One boundary that matters** — a single `lib/supabase/admin.ts` service-role file with
  five named callers; everything else uses the user JWT so RLS fires.
- **No Prisma client** — its privileged role would bypass RLS. Documented in AGENTS.md.
- **Rules encoded in the DB and pinned by tests** — source-text assertions verify the
  migration SQL still contains each CHECK/RLS constraint, so a loosened rule fails CI
  without a database.
- **Generated types** (`supabase gen types`), no hand-written drift.
- **271 unit tests + a deterministic end-to-end journey** that walks the full connected
  flow without a live AI call.

## 10. Maintainability, documentation, and explaining decisions

- **A real handoff system** — `AGENTS.md` (contract), `PLAN.md` (tasks), `WORKLOG.md`
  (record + handoff), `design/mock-ui.html` (spec). A fresh agent can resume mid-build.
- **Every architectural decision has a "why"** — AGENTS.md §5 and README decision tables.
- **One-command gate** — `npm run verify` (typecheck + lint + tests) makes "done"
  mechanical.
- **Limitations stated, not hidden** — no cron, single Gmail token per user, OAuth
  "Testing" status, advisory AI — each with a named next step.

## AI criteria coverage (brief: "meaningful use of AI")

All ten example AI capabilities are implemented, each zod-validated and writing an
`ai_run` row before returning.

| # | Criterion | Where | Returns |
|---|---|---|---|
| 1 | Summarizing company research | `lib/ai/prompts/research.ts` | `summary` (neutral profile) |
| 2 | Identifying missing information | same | `gaps[]` (field, why it matters, blocks qualification, how to find) |
| 3 | Recommending suitability | same | `suitability.recommendation` (proceed / research_more / nurture / disqualify) + confidence + `wouldChangeIf` |
| 4 | Prioritizing customers | same | `score` + `priorityReason`, persisted as priority rank |
| 5 | Identifying the decision-maker | same | `decisionMaker` (name from PEOPLE only, reasoning, fallback) |
| 6 | Generating an opportunity summary | same | `opportunitySummary` (commercial read) |
| 7 | Personalized outreach email | `lib/ai/prompts/draft.ts` | `subject`, `body`, `why[]`, `claimsUsed[]`, single `question` |
| 8 | Drafting follow-up | `lib/ai/prompts/followup.ts` | touch 2/3, `newAngle`, `recommendStopping` |
| 9 | Classifying incoming replies | `lib/ai/prompts/triage.ts` | `category`, `intent`, `urgency`, `confidence` |
| 10 | Recommending next action | same | `nextAction` (action, owner, `revisitOn`) + `suggestedStage` |

Design notes:

- Criteria 1–6 are deliberately a **single** research call (documented in the file
  header) — one call returns all six, rather than six calls reading the same record.
- Criteria 9–10 are a **single** triage call, built around the "split reply" case
  (technical vs commercial routing).
- All ten are covered by **four prompts total** (research, draft, follow-up, triage).
