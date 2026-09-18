import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { consentUrl } from '@/lib/gmail'

/**
 * T8.1 — step 1 of the connect flow. `state` carries the signed-in user's own
 * profile id, which the callback double-checks against the still-authenticated
 * session rather than trusting blindly.
 */
export async function GET() {
  const user = await currentUser()
  return NextResponse.redirect(consentUrl(user.id))
}
