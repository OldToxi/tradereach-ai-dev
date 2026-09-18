-- research_run is populated by the server action right after the AI call returns
-- (lib/research-actions.ts#runResearch), using the acting user's own client — not the
-- service role. It behaves like `fact`/`source` (a record a signed-in write-role user's
-- action adds), not like `ai_run` (a system bookkeeping row written from inside
-- lib/ai/client.ts, the one place the Anthropic SDK is called). Keeping this off the
-- service-role path avoids adding a fourth caller to lib/supabase/admin.ts's list.
create policy research_run_write on research_run for insert
  with check (can_write() and company_visible(company_id));
