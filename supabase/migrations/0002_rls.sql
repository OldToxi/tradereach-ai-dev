-- TradeReach AI — row-level security (T1.4)
--
-- ORDER MATTERS: apply 0003_auth_hook.sql (T1.5) BEFORE testing this file. These
-- policies read role and markets from the JWT. Without the hook the claims are
-- absent, every policy evaluates false, and the app looks completely broken while
-- being completely correct. That confusion costs an hour if you meet it blind.
--
-- Principles:
--   * Deny by default. RLS on for every table; a table with no policy is unreadable.
--   * Executives are scoped to their assigned markets. Manager, commercial and
--     auditor see everything.
--   * Auditors read, never write.
--   * gmail_token gets RLS and NO policies at all — unreachable by the user client.
--   * Writes that must never be blocked (audit rows) go through the service role.

-- ---------- claim helpers ----------
-- Kept as functions so a claim shape change is one edit, not thirty.

create or replace function auth.jwt_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'none')
$$;

create or replace function auth.jwt_markets() returns text[]
language sql stable as $$
  select coalesce(
    array(select jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'markets')),
    '{}'::text[]
  )
$$;

/* True for roles that are not market-scoped. */
create or replace function auth.sees_all_markets() returns boolean
language sql stable as $$
  select auth.jwt_role() in ('manager','commercial','auditor')
$$;

create or replace function auth.can_see_market(m text) returns boolean
language sql stable as $$
  select auth.sees_all_markets() or m = any (auth.jwt_markets())
$$;

create or replace function auth.can_write() returns boolean
language sql stable as $$
  select auth.jwt_role() in ('executive','manager','commercial')
$$;

create or replace function auth.can_approve() returns boolean
language sql stable as $$
  select auth.jwt_role() in ('manager','commercial')
$$;

create or replace function auth.is_commercial() returns boolean
language sql stable as $$
  select auth.jwt_role() = 'commercial'
$$;

-- ---------- enable everywhere ----------
alter table profiles      enable row level security;
alter table product       enable row level security;
alter table market        enable row level security;
alter table company       enable row level security;
alter table source        enable row level security;
alter table fact          enable row level security;
alter table contact       enable row level security;
alter table suppression   enable row level security;
alter table ai_run        enable row level security;
alter table message       enable row level security;
alter table reply         enable row level security;
alter table task          enable row level security;
alter table meeting       enable row level security;
alter table audit_event   enable row level security;
alter table gmail_token   enable row level security;   -- and no policies. See below.

-- ---------- profiles ----------
create policy profiles_read_self_and_team on profiles
  for select using (
    id = auth.uid() or auth.jwt_role() in ('manager','commercial','auditor')
  );

create policy profiles_manager_writes on profiles
  for all using (auth.jwt_role() = 'manager')
  with check (auth.jwt_role() = 'manager');

-- ---------- catalog: readable by all signed-in, writable by managers ----------
create policy product_read on product for select using (auth.uid() is not null);
create policy product_write on product for all
  using (auth.jwt_role() = 'manager') with check (auth.jwt_role() = 'manager');

create policy market_read on market for select using (auth.uid() is not null);
create policy market_write on market for all
  using (auth.jwt_role() = 'manager') with check (auth.jwt_role() = 'manager');

-- ---------- company: the market scope, and everything inherits it ----------
create policy company_read on company
  for select using (auth.can_see_market(market));

create policy company_insert on company
  for insert with check (auth.can_write() and auth.can_see_market(market));

create policy company_update on company
  for update using (auth.can_write() and auth.can_see_market(market))
  with check (auth.can_see_market(market));

-- Deletion is not a thing. Companies are disqualified or closed, never removed —
-- the research and the reason are the record. No delete policy exists, so no
-- delete is possible.

-- ---------- child tables: scope follows the parent company ----------
create or replace function auth.company_visible(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company c
     where c.id = cid and auth.can_see_market(c.market)
  )
$$;

create policy fact_read on fact for select using (auth.company_visible(company_id));
create policy fact_write on fact for all
  using (auth.can_write() and auth.company_visible(company_id))
  with check (auth.can_write() and auth.company_visible(company_id));

create policy source_read on source for select using (auth.company_visible(company_id));
create policy source_write on source for all
  using (auth.can_write() and auth.company_visible(company_id))
  with check (auth.can_write() and auth.company_visible(company_id));

create policy contact_read on contact for select using (auth.company_visible(company_id));
create policy contact_write on contact for all
  using (auth.can_write() and auth.company_visible(company_id))
  with check (auth.can_write() and auth.company_visible(company_id));

create policy task_read on task for select
  using (company_id is null or auth.company_visible(company_id));
create policy task_write on task for all
  using (auth.can_write() and (company_id is null or auth.company_visible(company_id)))
  with check (auth.can_write() and (company_id is null or auth.company_visible(company_id)));

create policy meeting_read on meeting for select using (auth.company_visible(company_id));
create policy meeting_write on meeting for all
  using (auth.can_write() and auth.company_visible(company_id))
  with check (auth.can_write() and auth.company_visible(company_id));

create policy reply_read on reply for select using (auth.company_visible(company_id));
create policy reply_write on reply for all
  using (auth.can_write() and auth.company_visible(company_id))
  with check (auth.can_write() and auth.company_visible(company_id));

create policy ai_run_read on ai_run for select
  using (company_id is null or auth.company_visible(company_id));
-- ai_run rows are written by the service role only. No insert policy.

-- ---------- message: where approval is enforced ----------
create policy message_read on message for select using (auth.company_visible(company_id));

create policy message_insert on message
  for insert with check (
    auth.can_write()
    and auth.company_visible(company_id)
    -- Nobody creates a row that is already approved. Approval is a separate,
    -- audited act performed by an approver.
    and status in ('draft','awaiting_approval')
    and approved_by is null
  );

/*
  The approval rule, in the database.

  An executive may edit their own draft and submit it for approval. Moving a row
  into approved, or out of held_commercial, requires the right role — so a bug in
  a server action, or a raw client hitting PostgREST directly, cannot approve
  anything.
*/
create policy message_update on message
  for update using (auth.can_write() and auth.company_visible(company_id))
  with check (
    auth.company_visible(company_id)
    and (
      -- ordinary editing, still unapproved
      (status in ('draft','awaiting_approval','rejected') and approved_by is null)
      -- approving: approver role, and it must be them
      or (status = 'approved' and auth.can_approve() and approved_by = auth.uid())
      -- releasing a held draft: commercial only
      or (status = 'held_commercial' and auth.is_commercial())
      -- sent is written by the connector path, service role only
    )
  );

-- ---------- suppression: add only, never remove ----------
create policy suppression_read on suppression for select using (auth.uid() is not null);
create policy suppression_insert on suppression
  for insert with check (auth.can_write());
-- No update, no delete policy. "No further contact" is permanent, and neither an
-- import nor an agent can undo it. Asserted by a test in T9.6.

-- ---------- audit: everyone reads their scope, nobody writes ----------
create policy audit_read on audit_event for select using (auth.uid() is not null);
-- No insert policy: audit rows come from the service role via lib/audit.ts.
-- No update or delete is possible anyway — see the rules in 0001_schema.sql.

-- ---------- gmail_token ----------
-- Intentionally no policies. RLS is on, so the user client can never read or write
-- this table under any circumstance. Only lib/supabase/admin.ts reaches it, and
-- only from lib/gmail.ts. Verified by a test in T12.2.

-- ---------- sanity check ----------
-- Run this after applying. Any table listed with rls_enabled = false is a hole.
--
--   select relname as table, relrowsecurity as rls_enabled,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--    order by relrowsecurity, relname;
--
-- Expect: every table true. gmail_token shows 0 policies — that is correct.
