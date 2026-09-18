-- TradeReach AI — source "supports" field (T4.5)
--
-- The mock's source table has a "What it supports" column ("Company is an
-- importer", "Certification", …) separate from the source *type* (registry,
-- trade press, directory). A source supports a specific claim, and that is what
-- the "Add source" modal captures.

alter table source add column supports text;
