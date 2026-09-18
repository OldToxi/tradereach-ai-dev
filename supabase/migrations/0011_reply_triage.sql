-- T9.3/T9.5 — reply triage columns, Gmail thread matching, history cursor.
--
-- 1. reply: the full structured triage output, beyond the four display columns the
--    table started with. answerable/reserved carry the split-reply separation, which
--    is the whole point of the demo — a buyer asks one thing we may answer and one
--    thing only a Commercial Authority may.
-- 2. message.gmail_thread_id: an incoming reply arrives on a Gmail thread; this maps
--    it back to the message we sent. createDraft() already returns the thread id, it
--    just was never stored.
-- 3. gmail_token.history_id: makes history.list an incremental poll rather than a
--    full re-read every time the Replies screen loads.

alter table reply
  add column intent_note text,
  add column answerable text[] not null default '{}',
  add column reserved jsonb not null default '[]',
  add column next_action text,
  add column next_action_reasoning text,
  add column next_action_owner text,
  add column revisit_on date,
  add column suggested_stage stage;

alter table message
  add column gmail_thread_id text;

alter table gmail_token
  add column history_id text;
