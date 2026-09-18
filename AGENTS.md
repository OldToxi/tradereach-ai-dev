# AGENTS.md — read this first, every session

You are building **TradeReach AI**, an export-outreach management platform for Anwar Group's
export team. This file is the contract. `PLAN.md` is the task list. `WORKLOG.md` is the
running record. `design/mock-ui.html` is the visual and behavioural specification.

Any agent (Claude Code, Cursor, Codex, Aider, a human) can pick this repo up mid-build by
reading these four files in that order.

---

## 1. Session start ritual — do this before writing any code

1. Read `WORKLOG.md`, bottom section first (`## Handoff`). It tells you exactly where the
   last agent stopped and why.
2. Read `PLAN.md`. Find the first task whose checkbox is `[ ]`. That is your task.
3. Run `npm run progress` to confirm the bar matches reality.
4. Run `npm run verify` (typecheck + lint + tests). If it fails on `main`, fixing that is
   your task instead — leave a `WORKLOG` line saying so.
5. Announce in one line: `Starting T4.2 — company detail facts panel`.

Never start a task out of order unless the plan marks it `parallel-safe`.

---

## 2. Session end ritual — after every single task

This is not optional and not batched. One task finished = one worklog update.

1. Run `npm run verify`. It must pass.
2. Tick the checkbox in `PLAN.md`: `- [x] T4.2 …`
3. Append an entry to `WORKLOG.md` under `## Log` using the template at the top of that file.
4. Run `npm run progress` — it rewrites the progress bar from the checkboxes.
5. `git add -A && git commit -m "T4.2 company detail facts panel"`
6. Only then start the next task.

If you skip the worklog, the next agent is blind. Treat it as part of the task.

---

## 3. Token / context stop protocol — **important**

You are likely to run out of context or hit a usage limit before this build is finished.
That is expected and planned for. It must never leave the repo in an unknown state.

**At roughly 95% of your context or usage budget, stop immediately.** Do not start a new
task. Do not try to squeeze in "one more thing". Instead:

1. Finish or safely abandon the current edit so the repo compiles (`npm run verify`). If it
   cannot be made to compile, `git stash` the broken work and say so.
2. Rewrite the `## Handoff` section at the bottom of `WORKLOG.md`, in full, covering:
   - Last completed task ID
   - Current task ID and exactly how far it got (files touched, what works, what doesn't)
   - Anything discovered that contradicts `PLAN.md` (wrong assumption, API surprise)
   - Any human action that is blocking progress (a token, a consent screen, a DNS record)
   - The literal next command the next agent should run
3. Run `npm run progress`.
4. Commit with message `handoff: stopped at T<id>, <n>% complete`.
5. Tell the user in plain language: what is done, what is next, and what they need to do.

Estimate your own budget conservatively. A handoff written at 95% is useful; one attempted
at 100% never gets written.

---

## 4. Non-negotiable product rules

These come from the assignment brief and are the highest-scoring part of the build. Never
relax one to make a task easier. If a task seems to require breaking one, stop and ask.

1. **Every fact carries provenance.** Four values: `verified`, `unverified`, `ai`,
   `human_approved`. A fact row cannot exist without one. `verified` requires a `source_id`
   or a `confirmed_by` user. Enforced by a database CHECK constraint, not by app code.
2. **AI output is never a fact.** A model may propose a value; only a person promotes it to
   `verified`. AI-written text is always rendered with the AI badge.
3. **Nothing is sent without a named approver.** `message.status = 'approved'` requires
   `approved_by`. Enforced by a CHECK constraint. The send/draft path reads that column.
4. **Reserved commercial matters are blocked.** Price, payment terms, credit, MOQ, freight,
   delivery date, samples, exclusivity, distributor appointment, warranty, technical
   compliance claims, discounts, rebates, contract length. A draft touching any of these is
   held for a `commercial` role. These values are never placed in an AI prompt's context.
5. **Demo safety.** Recipients must match `%.test`. Gmail scope is `gmail.compose` only —
   drafts, never sends. Both enforced server-side and asserted in tests.
6. **Audit everything that matters.** Approvals, field promotions, AI runs (model, prompt
   version, tokens, cost), connector calls, access refusals, score changes. Append-only.
7. **No secrets in the repo.** `.env.example` is committed with empty values.
   `.env.local` is gitignored. If you ever see a real key in a file you are editing, stop
   and tell the user.
8. **The stub auth bypass must fail loudly in production.** See `lib/session.ts`.

---

## 5. Architecture decisions already made — do not relitigate

| Area | Decision | Why |
|---|---|---|
| Framework | Next.js App Router + TypeScript | One deployable, server actions, Vercel |
| Styling | Tailwind, tokens copied from `design/mock-ui.html` `:root` | Mock is the spec |
| DB + Auth | Supabase (Postgres + Auth) | One service for both |
| DB access | `supabase-js` on the server with the **user's JWT** | So RLS actually fires |
| Prisma | **Not used as a client.** Plain SQL migrations in `supabase/migrations` | Prisma's privileged role bypasses RLS, making policies dead code |
| Service role | One file, `lib/supabase/admin.ts`, three callers only: audit writes, Gmail token read/refresh, seed | Auditable boundary |
| AI | Anthropic API, server-side only, structured JSON, schema-validated with zod | Four prompts total, not ten |
| Background work | None. `next_touch_at` computed on read; replies fetched on page load | No queue, no cron, same capability |
| Types | `supabase gen types typescript` → `lib/database.types.ts` | Don't hand-write |

**Four prompts only**, each versioned in `lib/ai/prompts/`:
- `research.ts` — one call returns `{ summary, gaps[], score, breakdown[], suitability, priority_reason, decision_maker }`
- `draft.ts` — first-touch outreach, returns `{ subject, body, why[], claims_used[] }`
- `followup.ts` — touch 2 and 3, must not repeat touch 1
- `triage.ts` — one call returns `{ category, intent, urgency, confidence, reasoning, next_action }`

Every AI call writes an `ai_run` row before returning.

---

## 6. The mock is the specification

`design/mock-ui.html` is a complete, working click-through of the finished product. Open it
in a browser. When a task says "build the review queue", the answer to "what should it look
like and what controls does it have" is in that file, in `<section id="s-review">`.

Rules for using it:
- Copy the CSS custom properties from `:root` into your Tailwind theme. The palette,
  provenance badge colours and dark-mode variants are already designed.
- Copy the seed data out of the `<script>` block — `COMPANIES`, `DETAIL`, `REPLIES`,
  `AUDIT`, etc. That is your seed file. The demo journey depends on this exact data.
- The screen list in the left rail is the route list.
- Copy is part of the design. Reuse the wording; it was written to be specific.

Where the mock and this file disagree, this file wins.

---

## 7. Definition of done for any UI task

- Renders correct data from Supabase through the user client (not the service role)
- Loading and empty states exist and say something useful
- Errors surface visibly — never a silent catch
- Provenance badges present wherever a fact is shown
- Role permissions respected in the UI *and* enforced by RLS
- Keyboard focus visible, works at 380px wide
- One test covering the rule the screen enforces
