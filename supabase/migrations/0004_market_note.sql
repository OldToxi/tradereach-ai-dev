-- 0004_market_note.sql — market-scoped facts with provenance.
--
-- T3.3. The market note detail in the mock carries per-note provenance badges
-- ("UN Comtrade 2025", "AI inferred from 9 replies", "Needs re-check for 2026"),
-- and AGENTS.md rule 1 says every fact carries provenance. The `fact` table is
-- company-scoped, so a market note needs its own table.
--
-- A market note mirrors `fact` but cites a free-text source_label instead of a
-- `source_id`, because `source` is company-scoped (source.company_id is not null).

create table market_note (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references market(id) on delete cascade,
  key text not null,
  value text not null,
  provenance provenance not null,
  source_label text,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),

  -- rule 1, market form: a verified note needs a cited source or a named person.
  constraint market_note_verified_needs_evidence check (
    provenance <> 'verified' or (source_label is not null or confirmed_by is not null)
  ),
  -- rule 2: a model can never mark its own output verified.
  constraint market_note_ai_cannot_be_confirmed check (
    provenance <> 'ai' or confirmed_by is null
  )
);

create unique index on market_note (market_id, key);

-- Same visibility as the market catalog: readable by any signed-in user, writable
-- by managers only (mirrors market_read / market_write).
alter table market_note enable row level security;

create policy market_note_read on market_note
  for select using (auth.uid() is not null);

create policy market_note_write on market_note
  for all using (jwt_role() = 'manager') with check (jwt_role() = 'manager');
