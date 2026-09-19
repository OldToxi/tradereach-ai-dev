/**
 * lib/thread.ts — pure helpers for the company Communication tab (T4.3's comms pane,
 * finished once the outreach phases landed in T7–T9).
 *
 * No Supabase, no cookies, no React. The only rule here is assembly: a company's
 * outbound messages and inbound replies are merged into one thread, newest first —
 * the order the mock renders in `design/mock-ui.html`'s `p-comms` pane — so it can be
 * unit-tested without a request or a database.
 */

export interface ThreadMessageInput {
  id: string
  subject: string
  body: string | null
  approverName: string | null
  timestamp: string
}

export interface ThreadReplyInput {
  id: string
  contactName: string | null
  subject: string | null
  body: string
  timestamp: string
  isSimulated: boolean
  category: string | null
  intent: string | null
  urgency: string | null
  confidence: number | null
  nextAction: string | null
}

export type ThreadItem =
  | { direction: 'out'; message: ThreadMessageInput }
  | { direction: 'in'; reply: ThreadReplyInput }

function timestampOf(item: ThreadItem): number {
  return new Date(item.direction === 'out' ? item.message.timestamp : item.reply.timestamp).getTime()
}

/**
 * Merges outbound messages and inbound replies into a single chronological thread,
 * newest first. The direction tag mirrors the mock's `in`/`out` split (inbound left
 * border is green, outbound is ochre).
 */
export function combineThread(
  messages: ThreadMessageInput[],
  replies: ThreadReplyInput[],
): ThreadItem[] {
  const items: ThreadItem[] = [
    ...messages.map((message) => ({ direction: 'out' as const, message })),
    ...replies.map((reply) => ({ direction: 'in' as const, reply })),
  ]
  return items.sort((a, b) => timestampOf(b) - timestampOf(a))
}
