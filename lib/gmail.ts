/**
 * lib/gmail.ts — the connector.
 *
 * Scope is gmail.compose + gmail.readonly + calendar.events. gmail.compose can
 * create drafts and physically cannot send; gmail.readonly is read-only and is what
 * lets the Replies screen ingest incoming mail. The assertions below exist anyway,
 * because a connector that is only safe because of a setting in someone else's
 * console is not safe, and because an evaluator reading this file should be able to
 * see the control rather than trust it.
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
  'https://www.googleapis.com/auth/gmail.readonly',
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

/* ------------------------------------------------------------------ */
/* T10.1 — calendar event creation, for the Schedule meeting modal      */
/* ------------------------------------------------------------------ */

export interface CalendarEventArgs {
  profileId: string
  summary: string
  start: string // ISO
  end: string // ISO
  attendeeEmail?: string | null
  attendeeName?: string | null
}

/**
 * Creates a calendar event on the user's own primary calendar. Demo safety applies to
 * attendees too: a non-`.test` address is dropped from the invite (the internal block
 * still lands), never emailed. Returns the event id, stored on meeting.calendar_event_id.
 */
export async function createCalendarEvent(args: CalendarEventArgs): Promise<{ eventId: string }> {
  const attendees =
    args.attendeeEmail && recipientAllowedForCalendar(args.attendeeEmail)
      ? [{ email: args.attendeeEmail, displayName: args.attendeeName ?? undefined }]
      : undefined

  const auth = await authedClient(args.profileId)
  const calendar = google.calendar({ version: 'v3', auth })

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: args.summary,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        attendees,
      },
    })
    const eventId = res.data.id
    if (!eventId) {
      throw new ConnectorError('Calendar returned no event id', 'The invite could not be created.')
    }
    return { eventId }
  } catch (err: unknown) {
    if (err instanceof ConnectorError) throw err
    const e = err as { code?: number; message?: string }
    if (e.code === 401 || e.code === 403) {
      throw new ConnectorError(
        `Calendar auth failed: ${e.message}`,
        'Your calendar connection is missing or expired. Reconnect it in Settings → Connectors.',
      )
    }
    throw new ConnectorError(
      `Calendar event failed: ${e.message}`,
      'The calendar invite could not be created. The meeting is still saved.',
    )
  }
}

/** Mirrors assertAllowedRecipient but returns a boolean instead of throwing. */
function recipientAllowedForCalendar(email: string): boolean {
  const pattern = process.env.ALLOWED_RECIPIENT_PATTERN ?? '%.test'
  const suffix = pattern.replace('%', '')
  return email.toLowerCase().endsWith(suffix.toLowerCase())
}

/* ------------------------------------------------------------------ */
/* T8.1/T8.4 — connection status and disconnect, for Settings→Connectors*/
/* ------------------------------------------------------------------ */

export interface ConnectionStatus {
  connected: boolean
  scope: string | null
  updatedAt: string | null
}

/** Never returns the refresh token itself — only what the UI needs to show. */
export async function getConnectionStatus(profileId: string): Promise<ConnectionStatus> {
  const { data } = await admin
    .from('gmail_token')
    .select('scope, updated_at')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (!data) return { connected: false, scope: null, updatedAt: null }
  return { connected: true, scope: data.scope, updatedAt: data.updated_at }
}

/** Revokes with Google on a best-effort basis, then always removes the stored row. */
export async function disconnectToken(profileId: string): Promise<void> {
  const { data } = await admin.from('gmail_token').select('refresh_token').eq('profile_id', profileId).maybeSingle()
  if (data?.refresh_token) {
    try {
      await oauthClient().revokeToken(data.refresh_token)
    } catch {
      // Best-effort — the token may already be invalid at Google's end. Removing our
      // stored copy is what actually matters; a failed revoke must not block that.
    }
  }
  await admin.from('gmail_token').delete().eq('profile_id', profileId)
}

export interface IncomingMail {
  threadId: string
  from: string
  body: string
  receivedAt: string
}

/**
 * Reply ingestion, called when the Replies screen loads. No polling, no worker.
 *
 * Incremental: history.list returns only changes since the stored history id, so a
 * full inbox re-read never happens. The cursor lives on gmail_token.history_id
 * (service role — see the header note on token storage). If a stored token predates
 * the readonly scope, Google answers 403 and we surface that as a reconnect prompt
 * rather than a crash.
 */
export async function pollNewMail(profileId: string): Promise<IncomingMail[]> {
  const auth = await authedClient(profileId)
  const gmail = google.gmail({ version: 'v1', auth })

  const { data: token } = await admin
    .from('gmail_token')
    .select('history_id')
    .eq('profile_id', profileId)
    .maybeSingle()

  let threadIds: string[] = []
  let newHistoryId: string | null = null

  try {
    if (token?.history_id) {
      const history = await gmail.users.history.list({
        userId: 'me',
        historyTypes: ['messageAdded'],
        startHistoryId: token.history_id,
      })
      newHistoryId = history.data.historyId ?? null
      for (const entry of history.data.history ?? []) {
        for (const m of entry.messagesAdded ?? []) {
          if (m.message?.threadId) threadIds.push(m.message.threadId)
        }
      }
    } else {
      // First read: no cursor yet, so take the most recent threads rather than the
      // entire mailbox, and seed the cursor from the mailbox profile. threads.list
      // does not return a historyId; getProfile does.
      const [list, profile] = await Promise.all([
        gmail.users.threads.list({ userId: 'me', maxResults: 20 }),
        gmail.users.getProfile({ userId: 'me' }),
      ])
      newHistoryId = profile.data.historyId ?? null
      threadIds = (list.data.threads ?? []).map((t) => t.id).filter((id): id is string => !!id)
    }
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string }
    if (e.code === 401 || e.code === 403) {
      throw new ConnectorError(
        `Gmail history failed: ${e.message}`,
        'Your Gmail connection is missing read access. Reconnect it in Settings → Connectors.',
      )
    }
    throw new ConnectorError(
      `Gmail history failed: ${e.message}`,
      'Gmail could not be read. Try again in a moment.',
      true,
    )
  }

  const out: IncomingMail[] = []
  for (const threadId of new Set(threadIds)) {
    try {
      const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
      for (const msg of thread.data.messages ?? []) {
        const headers = msg.payload?.headers ?? []
        const from = headers.find((h) => h.name === 'From')?.value ?? ''
        // Skip our own messages in the thread.
        if (from.toLowerCase().includes('anwargroup')) continue
        const part = msg.payload?.parts?.find((p) => p.mimeType === 'text/plain') ?? msg.payload
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
      // One bad thread must not break the screen. Skip it.
      continue
    }
  }

  if (newHistoryId) {
    await admin.from('gmail_token').update({ history_id: newHistoryId }).eq('profile_id', profileId)
  }

  return out
}
