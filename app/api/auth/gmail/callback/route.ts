import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@/lib/session'
import { storeTokenFromCode, ConnectorError } from '@/lib/gmail'

/**
 * T8.1 — step 2. Google redirects here after the consent screen. `state` is the
 * profile id from connect/route.ts; it must match the still-authenticated session,
 * not just be present, so a stale or forged state can't attach a token to the wrong
 * account.
 */
export async function GET(req: NextRequest) {
  const settingsUrl = new URL('/settings', req.url)
  settingsUrl.searchParams.set('tab', 'connectors')

  const error = req.nextUrl.searchParams.get('error')
  if (error) {
    settingsUrl.searchParams.set('gmail', 'denied')
    return NextResponse.redirect(settingsUrl)
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  if (!code || !state) {
    settingsUrl.searchParams.set('gmail', 'error')
    settingsUrl.searchParams.set('message', 'Google did not return an authorisation code.')
    return NextResponse.redirect(settingsUrl)
  }

  let user
  try {
    user = await currentUser()
  } catch {
    // Session expired mid-flow — send them to sign in, then back to Settings.
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', '/settings?tab=connectors')
    return NextResponse.redirect(loginUrl)
  }

  if (state !== user.id) {
    settingsUrl.searchParams.set('gmail', 'error')
    settingsUrl.searchParams.set('message', 'This connection request does not match your session. Try connecting again.')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    await storeTokenFromCode(code, user.id)
    settingsUrl.searchParams.set('gmail', 'connected')
  } catch (err) {
    settingsUrl.searchParams.set('gmail', 'error')
    settingsUrl.searchParams.set(
      'message',
      err instanceof ConnectorError ? err.userFacing : 'Could not complete the Gmail connection.',
    )
  }

  return NextResponse.redirect(settingsUrl)
}
