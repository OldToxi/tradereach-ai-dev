# TradeReach AI — build bundle

Export outreach management platform for Anwar Group. This repo currently contains the plan,
the visual specification, and the database rules. The application is not built yet.

## Read in this order

| File | What it is |
|---|---|
| `AGENTS.md` | The contract for any coding agent. Rules, architecture, stop protocol. |
| `PLAN.md` | 78 tasks in order, with checkboxes. The build. |
| `WORKLOG.md` | Running record + progress bar + handoff section. |
| `SETUP.md` | The 35 minutes of setup only a human can do. |
| `design/mock-ui.html` | Open in a browser. The complete click-through spec. |
| `supabase/migrations/0001_schema.sql` | Schema. The CHECK constraints are the product rules. |

## Start

```bash
npm install
npm run progress        # draws the bar, prints the next task
```

Then hand it to an agent:

> Read AGENTS.md, then PLAN.md, then the Handoff section of WORKLOG.md. Start at the first
> unticked task. After each task, update WORKLOG.md, run npm run progress, and commit.
> Stop at 95% of your usage budget and write the handoff.

## The four rules that carry this build

1. Every fact carries provenance — verified, unverified, AI, or human-approved.
2. AI output is never a fact until a person promotes it.
3. No message is approved without a named approver and a hash of the exact text.
4. Price, terms, MOQ, samples, freight and exclusivity are reserved for authorised staff.

All four are database constraints, not application logic. See `0001_schema.sql`.
