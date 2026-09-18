-- TradeReach AI — AI research pack storage (T5.1-T5.6)
--
-- research_run holds the structured output of lib/ai/prompts/research.ts: one row per
-- research call, newest-first per company. It is never edited by a human — the summary,
-- gaps and suitability call are AI output through and through (AGENTS.md rule 2), so
-- there is no provenance column to promote here. What a person DOES verify — the
-- qualification criteria the run found evidence for — is written to `fact` as normal,
-- with provenance 'ai', by the server action that calls this migration's table.
create table research_run (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  ai_run_id uuid not null references ai_run(id),
  summary text not null,
  opportunity_summary text not null,
  gaps jsonb not null default '[]',
  score int not null check (score between 0 and 100),
  breakdown jsonb not null default '[]',
  suitability jsonb not null,
  priority_reason text,
  decision_maker jsonb,
  created_at timestamptz not null default now()
);
create index on research_run (company_id, created_at desc);

alter table research_run enable row level security;
create policy research_run_read on research_run for select using (company_visible(company_id));
-- No insert/update/delete policy: written by the service role only (lib/ai/client.ts
-- pattern), same as ai_run. A model's own output is never something the user client
-- writes directly.

-- Manual priority override (T5.5). Null means "use the computed rank". Both columns
-- are set together by lib/research-actions.ts#overridePriority, which also requires a
-- mandatory reason and writes AUDIT.PRIORITY_OVERRIDDEN.
alter table company add column priority_override int;
alter table company add column priority_override_reason text;
