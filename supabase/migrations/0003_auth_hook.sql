-- TradeReach AI — custom access token hook (T1.5)
--
-- Copies role and assigned_markets from profiles into the JWT's app_metadata, so
-- every RLS policy reads them from the token instead of joining profiles on every
-- single query.
--
-- AFTER APPLYING, ENABLE IT IN THE DASHBOARD. The function existing is not enough:
--   Supabase Dashboard → Authentication → Hooks → Customize Access Token (JWT)
--   → select public.custom_access_token_hook → Save
--
-- Then sign out and back in. Existing tokens keep the old claims until they refresh,
-- which is the most common "I applied it and nothing changed" moment.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_role text;
  v_markets jsonb;
begin
  select p.role::text,
         coalesce(to_jsonb(p.assigned_markets), '[]'::jsonb)
    into v_role, v_markets
    from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if v_role is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}'::jsonb)
        || jsonb_build_object('role', v_role, 'markets', v_markets)
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The auth service calls this. Nothing else should be able to.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- The hook reads profiles, so the auth role needs to as well.
grant select on table public.profiles to supabase_auth_admin;

create policy profiles_auth_admin_read on public.profiles
  as permissive for select
  to supabase_auth_admin
  using (true);

-- Verify: sign in, then in the browser console
--   const { data } = await supabase.auth.getSession()
--   JSON.parse(atob(data.session.access_token.split('.')[1])).app_metadata
-- Expect { role: 'manager', markets: [...] }. If app_metadata is empty, the hook
-- is not enabled in the dashboard.
