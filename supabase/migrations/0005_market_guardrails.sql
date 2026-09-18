-- 0005_market_guardrails.sql — per-market outreach guardrails.
--
-- T3.4: send window and weekly outreach cap already live on `market` from 0001.
-- This adds the two remaining stored rules shown on the market-note guardrails
-- card, so the T7.4 pre-send checks read them from the DB instead of hard-coding.

alter table market
  add column required_before_sending text,
  add column legal_note text;
