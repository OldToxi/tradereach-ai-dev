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
`░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░` **0%** — 0 of 78 tasks complete

| Phase | Done | Total |
|---|---|---|
| 0 · Human setup | 0 | 6 |
| 1 · Foundation | 0 | 10 |
| 2 · Auth & shell | 0 | 5 |
| 3 · Catalog | 0 | 4 |
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

## Handoff

**Status:** not started.

- Last completed task: none
- Current task: none
- Blocked on: Phase 0 human setup. Nothing can be built until T0.3 (Supabase) and T0.6
  (`.env.local`) are done. T0.2 (Google Cloud OAuth) is the critical path and should be
  started first even though Gmail work does not begin until Phase 8.
- Next command for the next agent:

```
cat AGENTS.md && cat WORKLOG.md | tail -40 && npm run progress
```

Then begin at T1.1.
