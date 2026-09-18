-- T10.3 / T10.7 — blocking tasks gate + weekly read-out storage.

-- 1. A company with an open `blocks_stage` task cannot advance FORWARD through the
--    pipeline. This extends enforce_stage_gate (create or replace — the same layering
--    0004/0005/0009 used) so there is still exactly one place that explains why an
--    advance was refused.
--
--    The gate only fires on forward moves into the advance stages, and only when the
--    target stage is a real advance. Moving a company sideways into a holding lane
--    (nurture, disqualified, no_contact, closed) must stay possible — otherwise a
--    blocked lead could never be disqualified or closed.
create or replace function enforce_stage_gate() returns trigger as $$
declare
  unverified_count int;
  named_contact_count int;
  blocking_count int;
  stage_order text[] := array[
    'market_selection','company_research','qualification','contact_identification',
    'outreach','follow_up','reply','meeting','commercial_discussion',
    'nurture','disqualified','no_contact','closed'];
  old_idx int; new_idx int;
begin
  old_idx := coalesce(array_position(stage_order, old.stage::text), 0);
  new_idx := coalesce(array_position(stage_order, new.stage::text), 0);

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

  if new.stage in ('outreach','follow_up','reply','meeting','commercial_discussion') then
    select count(*) into named_contact_count
      from contact
     where company_id = new.id
       and email is not null
       and email_source is not null;
    if named_contact_count = 0 then
      raise exception
        'Cannot advance: no named contact with a recorded email source yet';
    end if;
  end if;

  if new_idx > old_idx
     and new.stage in ('contact_identification','outreach','follow_up','reply',
                       'meeting','commercial_discussion') then
    select count(*) into blocking_count
      from task
     where company_id = new.id
       and done = false
       and blocks_stage = true;
    if blocking_count > 0 then
      raise exception
        'Cannot advance: % open task(s) block stage advancement', blocking_count;
    end if;
  end if;

  return new;
end $$ language plpgsql;

-- 2. Weekly read-out, generated on demand and stored until a human marks it reviewed.
create table weekly_readout (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

alter table weekly_readout enable row level security;

-- A workspace-level summary crosses markets, so only roles that already see every
-- market may read it. Executives see the rest of the dashboard, not this panel.
create policy weekly_readout_read on weekly_readout
  for select using (sees_all_markets());
create policy weekly_readout_write on weekly_readout
  for all using (can_write() and sees_all_markets())
  with check (can_write() and sees_all_markets());
