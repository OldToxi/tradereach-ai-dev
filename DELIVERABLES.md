# TradeReach AI — Submission deliverables

This file maps the twelve deliverables from the assignment brief (§8) to where each one
lives in this repository, and records its current status.

| # | Deliverable | Status | Where it lives |
|---|---|---|---|
| 1 | Working MVP | ✅ Done (runs locally) | `app/`, `components/`, `lib/`. `npm run verify` is green (271 unit tests) and the Playwright twelve-step journey passes. |
| 2 | Source-code repository | ✅ Done (local) / ⚠️ needs push | GitHub remote `https://github.com/OldToxi/tradereach-ai-dev.git`. Local `main` is ahead of `origin/main` — run `git push`. |
| 3 | Setup & deployment instructions | ✅ Done | [`SETUP.md`](SETUP.md) (step-by-step human setup + Vercel deploy) and [`README.md`](README.md#quick-start). |
| 4 | Architecture & database overview | ✅ Done | [`README.md`](README.md#architecture) + [`README.md`](README.md#database-overview); schema in `supabase/migrations/`. |
| 5 | Technology stack explanation | ✅ Done | [`README.md`](README.md#architecture) (decision table). |
| 6 | AI workflow explanation | ✅ Done | [`README.md`](README.md#ai-workflow); the four prompts in `lib/ai/prompts/`. |
| 7 | Email / connector integration explanation | ✅ Done | [`README.md`](README.md#connector-integration); implementation in `lib/gmail.ts`, `lib/supabase/admin.ts`, `app/api/auth/gmail/`. |
| 8 | Completed & incomplete features | ✅ Done | [`README.md`](README.md#completed-vs-incomplete) + [`PLAN.md`](PLAN.md) (78/80 ticked). |
| 9 | Known limitations | ✅ Done | [`README.md`](README.md#known-limitations). |
| 10 | Recommended next steps | ✅ Done | [`README.md`](README.md#next-steps). |
| 11 | Demo video / live walkthrough | ⚠️ Script ready, not recorded | [`DEMO.md`](DEMO.md) — a scene-by-scene recording script. |
| 12 | Deployed test version | ⚠️ Pending (human Vercel step) | [`SETUP.md`](SETUP.md) step 5 and task `T12.5` in `PLAN.md`. |

## The two remaining human steps

Only two items are not yet finished, both human-owned:

1. **#2 — push the code.** The repository is committed locally but 23 commits have not
   been pushed to GitHub:
   ```bash
   git push
   ```
2. **#11 / #12 — record the demo and deploy.** Follow [`DEMO.md`](DEMO.md) to record the
   walkthrough, then deploy to Vercel using [`SETUP.md`](SETUP.md) step 5 and point the
   video / walkthrough at the deployed URL.

## Disclosure — external APIs, AI tools, libraries, and services

Everything used is listed in [`README.md`](README.md#third-party-disclosure):

| Type | Name | Purpose | Cost |
|---|---|---|---|
| External API / AI | Anthropic (Claude), or DeepSeek via its Anthropic-compatible endpoint | The four AI prompts: research, first-touch draft, follow-up, reply triage | Pay-per-token (free tier available) |
| External API | Google Gmail (`gmail.compose` scope only) | Create **drafts** in the approver's mailbox — never sends | Free |
| External API | Google Calendar (`calendar.events`) | Meeting events for the pipeline | Free |
| PaaS | Supabase (Postgres + Auth + RLS) | Database, authentication, row-level security | Free tier |
| PaaS | Vercel | Hosting / deployment | Free tier |
| Framework / libraries | Next.js, React, TypeScript, Tailwind CSS, zod | App framework, UI, typing, schema validation | Open source |
| Testing | Vitest, Playwright | Unit tests + end-to-end journey | Open source |
| Seed / third-party content | None — all demo companies, contacts, facts and sources are synthetic (`*.test` domains) | — | — |

No third-party UI templates or paid services are used. The visual design was built from
the project's own mock (`design/mock-ui.html`).
