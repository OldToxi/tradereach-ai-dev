-- TradeReach AI — runtime config for the AI workflow and commercial guardrails
-- (T11.4, T11.5).
--
-- Two small tables back the two remaining Settings tabs:
--
--   system_config  — single-row-per-key text config. Holds the monthly AI spend
--                    cap, the alert threshold, and the standard refusal template.
--                    Parsed by lib/system-config.ts; read at call time so a saved
--                    change takes effect without a redeploy.
--
--   reserved_matter — the list of commercial matters the guardrail blocks. The
--                    built-in rows mirror the ReservedMatter union in
--                    lib/guardrails.ts and are what the deterministic pattern pass
--                    recognises; custom rows are caught by the meaning-based model
--                    pass. Both lists feed Settings → Commercial guardrails.

create table system_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into system_config (key, value) values
  ('ai_monthly_cap_usd', '120'),
  ('ai_alert_threshold_pct', '80'),
  ('refusal_template',
   'On the commercial points you raised, those are set by our export desk rather than by me, so I have passed them to {authority}, who looks after commercial matters for {market}. They will write to you directly this week.');

create table reserved_matter (
  key text primary key,
  label text not null,
  is_builtin boolean not null default false,
  active boolean not null default true,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into reserved_matter (key, label, is_builtin, active, sort_order) values
  ('price',                  'Price',                          true, true, 1),
  ('payment_terms',          'Payment terms',                  true, true, 2),
  ('credit',                 'Credit',                         true, true, 3),
  ('moq',                    'Minimum order quantity',         true, true, 4),
  ('freight',                'Freight',                        true, true, 5),
  ('delivery_date',          'Delivery date',                  true, true, 6),
  ('samples',                'Samples',                        true, true, 7),
  ('exclusivity',            'Exclusivity',                    true, true, 8),
  ('distributor_appointment','Distributor appointment',        true, true, 9),
  ('warranty',               'Warranty',                       true, true, 10),
  ('technical_compliance',   'Technical compliance claims',    true, true, 11),
  ('discount',               'Discounts and rebates',          true, true, 12),
  ('contract_length',        'Contract length',                true, true, 13);

alter table system_config enable row level security;
alter table reserved_matter enable row level security;

-- Config is not sensitive: anyone signed in may read it (the AI client reads the
-- spend cap server-side, and the guardrail + reply draft read the refusal template
-- and matter list the same way). Only a manager may change them, mirroring the
-- manager-only Settings gate in the UI.
create policy system_config_read on system_config for select using (auth.uid() is not null);
create policy system_config_insert on system_config for insert with check (jwt_role() = 'manager');
create policy system_config_write on system_config for update
  using (jwt_role() = 'manager')
  with check (jwt_role() = 'manager');

create policy reserved_matter_read on reserved_matter for select using (auth.uid() is not null);
create policy reserved_matter_insert on reserved_matter for insert with check (jwt_role() = 'manager');
create policy reserved_matter_update on reserved_matter for update
  using (jwt_role() = 'manager')
  with check (jwt_role() = 'manager');
create policy reserved_matter_delete on reserved_matter for delete using (jwt_role() = 'manager');
