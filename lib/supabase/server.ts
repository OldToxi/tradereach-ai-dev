/**
 * lib/supabase/server.ts — the user client.
 *
 * This is the client almost everything uses. It carries the signed-in user's JWT,
 * so every query runs AS that user and row-level security actually fires. A query
 * that returns fewer rows than you expected is usually a policy doing its job, not
 * a bug — check with a different user before changing a policy.
 *
 * Never import lib/supabase/admin.ts from a page, component or ordinary server
 * action. Admin bypasses RLS entirely; it has three legal callers, listed there.
 */
import { cookies } from 'next/headers'
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '../database.types'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options as CookieOptions)
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to swallow —
            // it is the one documented exception in the Supabase SSR guide.
          }
        },
      },
    },
  )
}

/** For route handlers that need the client without the cookie dance. */
export function createAnonClient() {
  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}
