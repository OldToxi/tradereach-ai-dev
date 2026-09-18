-- TradeReach AI — core schema (T1.3)
-- Reference starting point. Extend it; do not rewrite it.
-- The CHECK constraints here are the product rules from AGENTS.md §4. They are the point.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type provenance   as enum ('verified','unverified','ai','human_approved');
create type user_role    as enum ('executive','manager','commercial','auditor');
create type stage        as enum (
  'market_selection','company_research','qualification','contact_identification',
  'outreach','follow_up','reply','meeting','commercial_discussion',
  'nurture','disqualified','no_contact','closed');
create type msg_status   as enum ('draft','awaiting_approval','held_commercial','approved','rejected','sent');
create type reply_category as enum (
  'buying_interest','information_request','pricing_request','not_now',
  'wrong_person','not_interested','unsubscribe','auto_reply');

-- ---------- people ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  full_name text not null,
  role user_role not null default 'executive',
  assigned_markets text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- catalog ----------
create table product (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hs_code text,
  certifications text[] default '{}',
  monthly_capacity text,
  lead_time text,
  -- The ONLY commercial text an AI prompt may read. Reserved matters never go here.
  capability_sheet text,
  created_at timestamptz not null default now()
);

create table market (
  id uuid primary key default gen_random_uuid(),
  country text unique not null,
  product_focus text,
  import_demand text,
  tariff_note text,
  priority text check (priority in ('high','medium','watch')) default 'medium',
  weekly_outreach_cap int not null default 12,
  send_window text,
  status text default 'active'
);

-- ---------- companies ----------
create table company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  market text not null references market(country),
  company_type text,
  stage stage not null default 'company_research',
  fit_score int check (fit_score between 0 and 100),
  owner_id uuid references profiles(id),
  product_id uuid references product(id),
  disqualified_reason text,
  next_touch_at timestamptz,          -- follow-ups computed on read, no job runner
  created_at timestamptz not null default now()
);
create index on company (market);
create index on company (stage);
create index on company (next_touch_at) where next_touch_at is not null;

create table source (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  url text,
  title text not null,
  source_type text,
  quality text check (quality in ('primary','secondary','weak')) default 'secondary',
  retrieved_at timestamptz not null default now()
);

-- Every fact about a company is a row here, and every row carries its provenance.
-- There is no way to store a fact without one.
create table fact (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  key text not null,
  value text not null,
  provenance provenance not null,
  source_id uuid references source(id),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  is_qualification_criterion boolean not null default false,
  created_at timestamptz not null default now(),

  -- AGENTS.md rule 1: verified means a source or a named person stands behind it.
  constraint verified_needs_evidence check (
    provenance <> 'verified' or (source_id is not null or confirmed_by is not null)
  ),
  -- AGENTS.md rule 2: a model can never mark its own output verified.
  constraint ai_cannot_be_confirmed check (
    provenance <> 'ai' or confirmed_by is null
  )
);
create unique index on fact (company_id, key);

create table contact (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  email_source text,                 -- where the address came from, in words
  provenance provenance not null default 'unverified',
  lawful_basis text,
  is_primary boolean not null default false,
  -- Rule: a contact is only writable-to when the address has a recorded origin.
  constraint verified_contact_needs_source check (
    provenance <> 'verified' or email_source is not null
  )
);

-- Permanent. Nothing may remove a row here — not an import, not an agent.
create table suppression (
  email_or_domain text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------- AI ----------
create table ai_run (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references company(id) on delete set null,
  prompt_name text not null,          -- research | draft | followup | triage
  prompt_version text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,5),
  confidence numeric(4,3),
  created_at timestamptz not null default now()
);

-- ---------- messages ----------
create table message (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  contact_id uuid references contact(id),
  kind text not null check (kind in ('first_touch','follow_up','reply','nurture')),
  touch_number int not null default 1,
  subject text not null,
  ai_body text not null,              -- exactly what the model wrote
  human_body text,                    -- exactly what the person approved, if edited
  why jsonb,                          -- the model's stated reasons, shown at review
  status msg_status not null default 'draft',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  approved_hash text,                 -- sha256 of the approved text
  rejected_reason text,
  reserved_matter text,               -- set when a guardrail holds the draft
  released_by uuid references profiles(id),
  gmail_draft_id text,
  ai_run_id uuid references ai_run(id),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),

  -- AGENTS.md rule 3: nothing is approved without a named approver and the exact text.
  constraint approved_needs_approver check (
    status not in ('approved','sent') or (approved_by is not null and approved_hash is not null)
  ),
  -- AGENTS.md rule 4: a held draft cannot be approved until someone releases it.
  constraint held_needs_release check (
    status <> 'approved' or reserved_matter is null or released_by is not null
  )
);

create table reply (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  contact_id uuid references contact(id),
  message_id uuid references message(id),
  body text not null,
  received_at timestamptz not null default now(),
  category reply_category,
  intent text,
  urgency text,
  confidence numeric(4,3),
  reasoning text,
  recommended_action text,
  corrected_category reply_category,  -- human override, kept for model review
  is_simulated boolean not null default false,
  ai_run_id uuid references ai_run(id)
);

-- ---------- work ----------
create table task (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references company(id) on delete cascade,
  title text not null,
  assignee_id uuid references profiles(id),
  due_on date,
  blocks_stage boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table meeting (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  starts_at timestamptz not null,
  purpose text,
  requires_commercial boolean not null default false,
  brief text,                          -- AI-written, always labelled as such
  calendar_event_id text
);

-- ---------- connector ----------
-- RLS on, zero policies. The user client can never read this, by design.
create table gmail_token (
  profile_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  scope text not null,
  updated_at timestamptz not null default now(),
  -- Compose-only. A token carrying send scope must not be storable.
  constraint compose_only check (scope not like '%gmail.send%')
);

-- ---------- audit ----------
create table audit_event (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  actor_label text not null,           -- 'Rifat Hasan' | 'AI (sonnet-class)' | 'System'
  event text not null,
  object_type text,
  object_id uuid,
  detail text,
  ip inet,
  created_at timestamptz not null default now()
);

-- Append-only: no updates, no deletes, ever. Proven by a test in T11.1.
create rule audit_no_update as on update to audit_event do instead nothing;
create rule audit_no_delete as on delete to audit_event do instead nothing;

-- ---------- stage gate ----------
-- A company cannot pass Qualification while a qualification fact is unverified.
create or replace function enforce_stage_gate() returns trigger as $$
declare unverified_count int;
begin
  if new.stage in ('contact_identification','outreach','follow_up','reply',
                   'meeting','commercial_discussion') then
    select count(*) into unverified_count
      from fact
     where company_id = new.id
       and is_qualification_criterion
       and provenance <> 'verified';
    if unverified_count > 0 then
      raise exception
        'Cannot advance: % qualification field(s) are still unverified', unverified_count;
    end if;
  end if;
  return new;
end $$ language plpgsql;

create trigger company_stage_gate
  before update of stage on company
  for each row execute function enforce_stage_gate();
