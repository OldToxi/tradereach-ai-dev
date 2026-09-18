/**
 * lib/outreach.ts — pure helpers for the "Sent & follow-ups" screen (T13.2).
 *
 * No Supabase, no cookies, no React, no Anthropic SDK. The rules that decide what a
 * sent or approved message's status is, and what the cadence will do next, are plain
 * functions so they can be unit-tested without a request or a database.
 *
 * The screen is assembled from three things the database already has: messages with
 * status `sent`/`approved`, the reply thread, and each company's `next_touch_at`
 * (which lib/messages.ts's cadence already computes elsewhere and the seed sets
 * directly for follow-up-stage companies). No new AI prompt — the "what is working"
 * narrative in the mock is omitted deliberately because AGENTS.md §5 caps us at four
 * prompts and none of them produces it.
 */
import { cadenceFor, isFollowupDue, nextTouchNumber } from './messages'
import { NEXT_ACTION_LABELS } from './replies'

export interface OutreachCompanyInput {
  id: string
  name: string
  market: string
  /** The `stage` enum value; only `nurture` changes the label we show. */
  stage: string | null
  nextTouchAt: string | null
}

export interface OutreachMessageInput {
  companyId: string
  contactName: string | null
  kind: string
  touchNumber: number
  subject: string
  status: 'sent' | 'approved'
  approverName: string | null
  approvedAt: string | null
  scheduledFor: string | null
  createdAt: string
}

export interface OutreachReplyInput {
  companyId: string
  nextAction: string | null
  receivedAt: string
}

export type OutreachStatus =
  | 'replied'
  | 'awaiting_reply'
  | 'approved'
  | 'follow_up_due'
  | 'follow_up_scheduled'

export interface OutreachRow {
  companyId: string
  company: string
  market: string
  contact: string | null
  messageLabel: string
  subject: string
  approver: string | null
  status: OutreachStatus
  statusLabel: string
  nextStep: string
  tone: 'ok' | 'due' | 'plain'
}

/** "First-touch" for touch 1, "Follow-up 1" for touch 2, and so on. */
export function messageLabel(kind: string, touchNumber: number): string {
  if (kind === 'first_touch') return 'First-touch'
  return `Follow-up ${touchNumber - 1}`
}

/** The next step for a company that has replied, from the triage's next_action. */
export function repliedNextStep(nextAction: string | null): string {
  if (!nextAction) return 'Reply awaiting triage'
  return NEXT_ACTION_LABELS[nextAction] ?? nextAction
}

/** "due today" / "due tomorrow" / "due Wed" / "overdue" for a scheduled touch date. */
export function touchDueLabel(dueDate: Date, now: Date): { text: string; overdue: boolean } {
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).getTime()
  const diff = Math.round((startOfDay(dueDate) - startOfDay(now)) / 864e5)
  if (diff < 0) return { text: 'overdue', overdue: true }
  if (diff === 0) return { text: 'due today', overdue: true }
  if (diff === 1) return { text: 'due tomorrow', overdue: false }
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(dueDate)
  return { text: `due ${weekday}`, overdue: false }
}

/** "Tue 09:10" for an approved message that is queued to send. */
export function sendLabel(iso: string): string {
  const d = new Date(iso)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(d)
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(d)
  return `${weekday} ${time}`
}

const RANK: Record<OutreachStatus, number> = {
  replied: 1,
  follow_up_due: 2,
  approved: 3,
  awaiting_reply: 4,
  follow_up_scheduled: 5,
}

function sortRows(rows: OutreachRow[]): OutreachRow[] {
  return rows.sort((a, b) => {
    if (a.tone === 'due' && b.tone !== 'due') return -1
    if (b.tone === 'due' && a.tone !== 'due') return 1
    const byRank = RANK[a.status] - RANK[b.status]
    if (byRank !== 0) return byRank
    return a.company.localeCompare(b.company)
  })
}

/**
 * The sent/follow-up list. One row per company that has a sent/approved message or a
 * scheduled next touch, sorted so that overdue follow-ups surface first.
 */
export function computeOutreach(
  companies: OutreachCompanyInput[],
  messages: OutreachMessageInput[],
  replies: OutreachReplyInput[],
  now: Date,
): OutreachRow[] {
  const byId = new Map(companies.map((c) => [c.id, c]))

  const byCompany = new Map<string, OutreachMessageInput[]>()
  for (const m of messages) {
    const list = byCompany.get(m.companyId) ?? []
    list.push(m)
    byCompany.set(m.companyId, list)
  }

  const latestReply = new Map<string, OutreachReplyInput>()
  for (const r of replies) {
    const cur = latestReply.get(r.companyId)
    if (!cur || r.receivedAt >= cur.receivedAt) latestReply.set(r.companyId, r)
  }

  const rows: OutreachRow[] = []

  for (const [companyId, msgs] of byCompany) {
    const company = byId.get(companyId)
    if (!company) continue

    const base = {
      companyId,
      company: company.name,
      market: company.market,
    }

    // An approved-but-not-yet-sent message is the front of the queue.
    const approved = msgs.filter((m) => m.status === 'approved')
    if (approved.length) {
      const latest = approved.sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]
      rows.push({
        ...base,
        contact: latest.contactName,
        messageLabel: messageLabel(latest.kind, latest.touchNumber),
        subject: latest.subject,
        approver: latest.approverName,
        status: 'approved',
        statusLabel: 'Approved',
        nextStep: latest.scheduledFor ? `Sends ${sendLabel(latest.scheduledFor)}` : 'Ready to send',
        tone: 'plain',
      })
      continue
    }

    const sent = msgs
      .filter((m) => m.status === 'sent')
      .sort((x, y) => x.touchNumber - y.touchNumber)
    const latest = sent[sent.length - 1]
    const reply = latestReply.get(companyId)

    if (reply) {
      rows.push({
        ...base,
        contact: latest.contactName,
        messageLabel: messageLabel(latest.kind, latest.touchNumber),
        subject: latest.subject,
        approver: latest.approverName,
        status: 'replied',
        statusLabel: 'Replied',
        nextStep: repliedNextStep(reply.nextAction),
        tone: 'ok',
      })
      continue
    }

    const history = sent.map((m) => ({
      touchNumber: m.touchNumber,
      createdAt: m.approvedAt ?? m.createdAt,
    }))
    const next = nextTouchNumber(history, false)
    if (next === null) {
      rows.push({
        ...base,
        contact: latest.contactName,
        messageLabel: messageLabel(latest.kind, latest.touchNumber),
        subject: latest.subject,
        approver: latest.approverName,
        status: 'awaiting_reply',
        statusLabel: 'No reply',
        nextStep: 'Cadence complete — nurture',
        tone: 'plain',
      })
      continue
    }

    const first = sent.find((m) => m.touchNumber === 1)
    const sentAt = new Date(first?.approvedAt ?? first?.createdAt ?? latest.createdAt)
    const cadence = cadenceFor(sentAt)
    const dueDate = next === 2 ? cadence.touch2Due : cadence.touch3Due
    const dl = touchDueLabel(dueDate, now)
    rows.push({
      ...base,
      contact: latest.contactName,
      messageLabel: messageLabel(latest.kind, latest.touchNumber),
      subject: latest.subject,
      approver: latest.approverName,
      status: 'awaiting_reply',
      statusLabel: 'No reply',
      nextStep: `Follow-up ${next - 1} ${dl.text}`,
      tone: dl.overdue ? 'due' : 'plain',
    })
  }

  // Follow-up-stage companies that have a next touch scheduled but no message thread
  // on file yet (the seed sets `next_touch_at` directly for these).
  const withMessages = new Set(byCompany.keys())
  for (const company of companies) {
    if (withMessages.has(company.id)) continue
    if (!company.nextTouchAt) continue
    if (latestReply.has(company.id)) continue

    const nurturing = company.stage === 'nurture'
    const dl = touchDueLabel(new Date(company.nextTouchAt), now)
    rows.push({
      companyId: company.id,
      company: company.name,
      market: company.market,
      contact: null,
      messageLabel: nurturing ? 'Nurture touch' : 'Follow-up',
      subject: '',
      approver: null,
      status: dl.overdue ? 'follow_up_due' : 'follow_up_scheduled',
      statusLabel: nurturing
        ? dl.overdue
          ? 'Nurture due'
          : 'Nurture scheduled'
        : dl.overdue
          ? 'Follow-up due'
          : 'Follow-up scheduled',
      nextStep: nurturing ? `Nurture touch ${dl.text}` : `Follow-up ${dl.text}`,
      tone: dl.overdue ? 'due' : 'plain',
    })
  }

  return sortRows(rows)
}
