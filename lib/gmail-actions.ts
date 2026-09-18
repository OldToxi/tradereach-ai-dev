'use server'

/**
 * lib/gmail-actions.ts — server actions for Settings → Connectors (T8.4). Message
 * Gmail-draft creation/retry (T8.3) lives in lib/message-actions.ts instead, since it
 * needs the approver's own RLS-scoped client to write message.gmail_draft_id — see
 * that file's attemptGmailDraft for why it must be the same actor who approved it.
 */
import { revalidatePath } from 'next/cache'
import { currentUser } from './session'
import { disconnectToken } from './gmail'

export type GmailActionState = { ok: boolean; error?: string }

export async function disconnectGmail(): Promise<GmailActionState> {
  const user = await currentUser()
  await disconnectToken(user.id)
  revalidatePath('/settings')
  return { ok: true }
}
