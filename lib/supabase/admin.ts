/**
 * lib/supabase/admin.ts — the service-role client. BYPASSES ALL ROW-LEVEL SECURITY.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LEGAL CALLERS. Adding another is an architecture decision, not a          │
 * │ convenience — discuss it before you do it, and record it in WORKLOG.md.   │
 * │                                                                          │
 * │   1. lib/audit.ts        — audit rows must never be blocked by a policy   │
 * │   2. lib/gmail.ts        — gmail_token has RLS on and zero policies       │
 * │   3. scripts/seed.ts     — runs before any user exists                    │
 * │   4. lib/reply-actions.ts — read-only commercial-authority lookup (see    │
 * │                             below)                                        │
 * │   5. lib/user-actions.ts — user administration: inviting a user creates   │
 * │                             an auth.user (only the service role can), the  │
 * │                             team table reads last_sign_in_at, and the     │
 * │                             invite path inserts the profile row.          │
 * │                                                                          │
 * │ lib/ai/context.ts and lib/ai/client.ts also use it, and that is           │
 * │ deliberate: prompt context is assembled server-side from facts the        │
 * │ requesting user has already been authorised to view by the calling page.  │
 * │ Always check access with the user client first, then build context.       │
 * │                                                                          │
 * │ lib/reply-actions.ts uses it for ONE read-only resolution: mapping the    │
 * │ "commercial" role to a user id/name for escalation routing. Executives    │
 * │ cannot read other profiles through RLS (see profiles_read_self_and_team), │
 * │ so this lookup cannot go through the user client. It is a name/id read,   │
 * │ not a write bypass — every write in that file still uses the user client. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * If you are writing a page or an ordinary server action and reach for this file,
 * you almost certainly want lib/supabase/server.ts instead.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error(
    'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  )
}

// This key must never reach the browser. Next.js only inlines NEXT_PUBLIC_* vars,
// so importing this file into a client component is a build error rather than a leak —
// but do not rely on that. Server code only.
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/admin.ts was imported into client code. Remove that import.')
}

export const admin = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
