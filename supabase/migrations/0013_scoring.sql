-- TradeReach AI — fit-score weights (T11.3)
--
-- The fit score is a weighted sum over six fixed criteria (see lib/scoring.ts and
-- the SCORING section of lib/ai/prompts/research.ts). Those weights are editable
-- from Settings → Scoring by a manager, and saving them re-derives every company's
-- fit_score from its latest stored breakdown (lib/scoring-actions.ts). The stored
-- research_run breakdowns are never rewritten — a past decision can always be
-- explained against the weights that were in force when it was scored.
create table score_weight (
  criterion_key text primary key,
  label text not null,
  weight int not null check (weight between 0 and 100),
  sort_order int not null,
  updated_at timestamptz not null default now()
);

insert into score_weight (criterion_key, label, weight, sort_order) values
  ('imports_category',      'Imports this product category already',        30, 1),
  ('buys_south_asia',       'Buys from Bangladesh or South Asia today',      20, 2),
  ('volume_fit',            'Volume fits our monthly capacity',              15, 3),
  ('certification_match',   'Certification requirements we already meet',    15, 4),
  ('decision_maker_found',  'Named decision-maker identified',               10, 5),
  ('market_priority',       'Market priority',                               10, 6);

alter table score_weight enable row level security;

-- Weights are not sensitive: anyone signed in may read them (the research prompt
-- reads them server-side through the acting user's client too). Only a manager may
-- change them, mirroring the manager-only Settings gate in the UI.
create policy score_weight_read on score_weight for select using (auth.uid() is not null);
create policy score_weight_write on score_weight for update
  using (jwt_role() = 'manager')
  with check (jwt_role() = 'manager');
