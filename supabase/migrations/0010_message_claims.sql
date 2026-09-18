-- T7.1/T7.3 — draft.ts and followup.ts both return claimsUsed[] (claim + fromFact),
-- which the review queue needs to highlight and to re-check against current fact
-- state (T7.4's "every claim traced to a verified source" check). `why` already
-- exists for the short bullet reasons; this is the structured claim/source mapping.
alter table message add column claims_used jsonb not null default '[]';
