-- T6.4 — a company cannot leave Contact identification without a named contact whose
-- email has a recorded source. Extends the T4.7 stage-gate trigger (create or replace,
-- same pattern 0002/0004/0005 used to layer onto 0001 — the trigger itself, attached in
-- 0001, is unchanged) rather than adding a second trigger, so there is one place that
-- explains why an advance was refused.
--
-- Deliberately does NOT block entering 'contact_identification' itself — that is the
-- stage where the contact is still being found. It blocks leaving it.
create or replace function enforce_stage_gate() returns trigger as $$
declare
  unverified_count int;
  named_contact_count int;
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

  return new;
end $$ language plpgsql;
