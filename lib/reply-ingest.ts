/**
 * lib/reply-ingest.ts — pulls new incoming mail on the Replies screen load (T9.2).
 *
 * Deliberately a plain async function, not a server action: it runs during the page
 * render (no worker, no cron, per the architecture decision), so it must not call
 * revalidatePath. It reads Gmail through lib/gmail.ts (service role for the token,
 * which is invisible to the user client) but writes reply rows through the caller's
 * own RLS-scoped client — the same boundary every other write uses.
 */
import { currentUser } from './session'
import { createServerClient } from './supabase/server'
import { pollNewMail, ConnectorError } from './gmail'
import { writeAudit, AUDIT } from './audit'

export interface IngestResult {
  ingested: number
  unmatched: number
  degraded: boolean
  note?: string
}

export async function ingestReplies(): Promise<IngestResult> {
  const user = await currentUser()
  const supabase = await createServerClient()

  let mail
  try {
    mail = await pollNewMail(user.id)
  } catch (err) {
    // Degrade gracefully: the screen still renders what is already in the database.
    // A token that predates the readonly scope, or no token at all, is a settings
    // action for the user, not a crash.
    return {
      ingested: 0,
      unmatched: 0,
      degraded: true,
      note: err instanceof ConnectorError ? err.userFacing : 'Gmail could not be read.',
    }
  }

  if (!mail.length) return { ingested: 0, unmatched: 0, degraded: false }

  const { data: sent } = await supabase
    .from('message')
    .select('id, company_id, contact_id, gmail_thread_id')
    .not('gmail_thread_id', 'is', null)
  const byThread = new Map((sent ?? []).map((m) => [m.gmail_thread_id, m]))

  let ingested = 0
  let unmatched = 0

  for (const incoming of mail) {
    const message = byThread.get(incoming.threadId)
    if (!message || !message.contact_id) {
      unmatched++
      continue
    }

    // Dedup: internalDate is stable, so a re-read of the same mail (e.g. before the
    // history cursor is first persisted) maps to the same received_at.
    const { data: existing } = await supabase
      .from('reply')
      .select('id')
      .eq('message_id', message.id)
      .eq('received_at', incoming.receivedAt)
      .maybeSingle()
    if (existing) continue

    const { data: reply, error } = await supabase
      .from('reply')
      .insert({
        company_id: message.company_id,
        contact_id: message.contact_id,
        message_id: message.id,
        body: incoming.body,
        received_at: incoming.receivedAt,
        is_simulated: false,
      })
      .select('id')
      .single()
    if (error || !reply) continue

    await writeAudit({
      actorLabel: 'Gmail (readonly)',
      event: AUDIT.REPLY_INGESTED,
      objectType: 'reply',
      objectId: reply.id,
      detail: `Incoming reply from ${incoming.from}`,
    })
    ingested++
  }

  return {
    ingested,
    unmatched,
    degraded: false,
    note: unmatched ? `${unmatched} message(s) could not be matched to a thread.` : undefined,
  }
}
