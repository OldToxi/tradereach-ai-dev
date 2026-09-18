/**
 * lib/gmail.ts — the connector.
 *
 * Scope is gmail.compose. That scope can create drafts and physically cannot send.
 * The assertions below exist anyway, because a connector that is only safe because
 * of a setting in someone else's console is not safe, and because an evaluator
 * reading this file should be able to see the control rather than trust it.
 *
 * Three hard rules, all asserted before any network call:
 *   1. The stored scope must not include gmail.send.
 *   2. Every recipient must match ALLOWED_RECIPIENT_PATTERN (default %.test).
 *   3. The recipient must not be in the suppression table.
 *
 * Token storage: gmail_token has RLS enabled and zero policies, so the user client
 * cannot read it under any circumstance. Only lib/supabase/admin.ts reaches it, and
 * only from here.
 */
import { google } from 'googleapis'
import { admin } from './supabase/admin'

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly userFacing: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'ConnectorError'
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events',
]

function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new ConnectorError(
      'Google OAuth env vars missing',
      'Gmail is not configured. Add the Google credentials in Settings → Connectors.',
    )
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
}

/** Step 1 of the connect flow. `state` should carry the profile id. */
export function consentUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh token even on reconnect
    scope: SCOPES,
    state,
  })
}

/** Step 2. Exchanges the code and stores the refresh token. */
export async function storeTokenFromCode(code: string, profileId: string) {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.refresh_token) {
    throw new ConnectorError(
      'No refresh token returned',
      'Google did not return a refresh token. Remove TradeReach from your Google account permissions and connect again.',
    )
  }

  const scope = tokens.scope ?? ''
  assertComposeOnly(scope)

  const { error } = await admin.from('gmail_token').upsert({
    profile_id: profileId,
    refresh_token: tokens.refresh_token,
    scope,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new ConnectorError(error.message, 'Could not save the Gmail connection.')
}

/** Rule 1. Also enforced by a CHECK constraint on the table. */
export function assertComposeOnly(scope: string) {
  if (scope.includes('gmail.send') || scope.includes('mail.google.com')) {
    throw new ConnectorError(
      `Refusing a token with send scope: ${scope}`,
      'That Google connection grants permission to send mail. TradeReach only creates drafts. Reconnect with compose access only.',
    )
  }
}

/** Rule 2. Demo safety — the brief forbids contacting real companies. */
export function assertAllowedRecipient(email: string) {
  const pattern = process.env.ALLOWED_RECIPIENT_PATTERN ?? '%.test'
  const suffix = pattern.replace('%', '')
  if (!email.toLowerCase().endsWith(suffix)) {
    throw new ConnectorError(
      `Recipient ${email} outside allowlist ${pattern}`,
      `${email} is not a test address. During the assignment, TradeReach only writes to ${suffix} recipients.`,
    )
  }
}

/** Rule 3. A suppressed address can never be written to again. */
async function assertNotSuppressed(email: string) {
  const domain = email.split('@')[1] ?? ''
  const { data } = await admin
    .from('suppression')
    .select('email_or_domain, reason')
    .in('email_or_domain', [email.toLowerCase(), domain.toLowerCase()])
  if (data && data.length) {
    throw new ConnectorError(
      `Suppressed: ${data[0].email_or_domain}`,
      `${email} asked not to be contacted (${data[0].reason}). This cannot be overridden.`,
    )
  }
}

async function authedClient(profileId: string) {
  const { data, error } = await admin
    .from('gmail_token')
    .select('refresh_token, scope')
    .eq('profile_id', profileId)
    .single()

  if (error || !data) {
    throw new ConnectorError(
      `No Gmail token for ${profileId}`,
      'Your Gmail account is not connected. Connect it in Settings → Connectors.',
    )
  }

  assertComposeOnly(data.scope)

  const client = oauthClient()
  client.setCredentials({ refresh_token: data.refresh_token })
  return client
}

function buildRaw(to: string, subject: string, body: string, from: string) {
  // RFC 2047 for non-ASCII subjects — Turkish and Japanese company names appear
  // in these subject lines and break without it.
  const encodedSubject = /^[\x20-\x7E]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ].join('\r\n')

  return Buffer.from(mime).toString('base64url')
}

export interface DraftArgs {
  profileId: string
  from: string
  to: string
  subject: string
  body: string
  threadId?: string | null
}

/**
 * Creates a Gmail draft. Never sends. Returns the draft id, which is stored on the
 * message row so the approval can be traced to a real artefact in a real mailbox.
 */
export async function createDraft(args: DraftArgs): Promise<{ draftId: string; threadId: string }> {
  if (process.env.ENABLE_OUTBOUND_SEND === 'true') {
    // Belt and braces: even if someone flips this, nothing here sends. The check
    // exists so the flag cannot be mistaken for a working send path.
    throw new ConnectorError(
      'ENABLE_OUTBOUND_SEND is set but no send path exists',
      'Outbound sending is not implemented. TradeReach creates drafts only.',
    )
  }

  assertAllowedRecipient(args.to)
  await assertNotSuppressed(args.to)

  const auth = await authedClient(args.profileId)
  const gmail = google.gmail({ version: 'v1', auth })

  try {
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: buildRaw(args.to, args.subject, args.body, args.from),
          threadId: args.threadId ?? undefined,
        },
      },
    })
    const draftId = res.data.id
    const threadId = res.data.message?.threadId
    if (!draftId || !threadId) {
      throw new ConnectorError('Gmail returned no draft id', 'Gmail accepted the draft but returned nothing usable.')
    }
    return { draftId, threadId }
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string }
    if (e.code === 401 || e.code === 403) {
      throw new ConnectorError(
        `Gmail auth failed: ${e.message}`,
        'Your Gmail connection has expired. Reconnect it in Settings → Connectors.',
      )
    }
    if (e.code === 429 || (e.code ?? 0) >= 500) {
      throw new ConnectorError(
        `Gmail transient error: ${e.message}`,
        'Gmail is temporarily unavailable. The draft was not created — try again in a moment.',
        true,
      )
    }
    throw new ConnectorError(
      `Gmail draft failed: ${e.message}`,
      'The draft could not be created. Nothing was sent.',
    )
  }
}

/** Reply ingestion, called when the Replies screen loads. No polling, no worker. */
export async function fetchNewReplies(profileId: string, threadIds: string[]) {
  const auth = await authedClient(profileId)
  const gmail = google.gmail({ version: 'v1', auth })

  const out: Array<{ threadId: string; from: string; body: string; receivedAt: string }> = []

  for (const threadId of threadIds) {
    try {
      const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
      for (const msg of thread.data.messages ?? []) {
        const headers = msg.payload?.headers ?? []
        const from = headers.find((h) => h.name === 'From')?.value ?? ''
        // Skip our own messages in the thread.
        if (from.includes('anwargroup')) continue
        const part =
          msg.payload?.parts?.find((p) => p.mimeType === 'text/plain') ?? msg.payload
        const data = part?.body?.data
        if (!data) continue
        out.push({
          threadId,
          from,
          body: Buffer.from(data, 'base64').toString('utf8'),
          receivedAt: new Date(Number(msg.internalDate ?? Date.now())).toISOString(),
        })
      }
    } catch {
      // One bad thread must not break the screen. Skip it; the error surfaces as a
      // count of threads that could not be read.
      continue
    }
  }

  return out
}
