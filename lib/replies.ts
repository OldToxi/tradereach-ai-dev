/**
 * lib/replies.ts — pure helpers for the Replies screen (T9.3–T9.6).
 *
 * No Supabase, no cookies, no React, no Anthropic SDK. The rules that decide how a
 * reply is labelled, how the technical half of a split reply is drafted, and what a
 * "no further contact" suppresses are plain functions so they can be unit-tested
 * without a request, a database or a model call.
 */
import { domainOf } from './contacts'
import { scanPatterns, refusalFromTemplate, DEFAULT_REFUSAL_TEMPLATE } from './guardrails'

export const CATEGORY_LABELS: Record<string, string> = {
  buying_interest: 'Buying interest',
  information_request: 'Information request',
  pricing_request: 'Pricing request',
  not_now: 'Not now',
  wrong_person: 'Wrong person',
  not_interested: 'Not interested',
  unsubscribe: 'Unsubscribe',
  auto_reply: 'Auto-reply',
}

export const INTENT_LABELS: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  none: 'None',
}

export const URGENCY_LABELS: Record<string, string> = {
  same_day: 'Reply same day',
  within_24h: 'Reply within 24h',
  within_week: 'Reply within a week',
  none: 'No action this week',
}

export const NEXT_ACTION_LABELS: Record<string, string> = {
  draft_reply: 'Draft a reply',
  escalate_commercial: 'Escalate to commercial',
  book_meeting: 'Book a meeting',
  nurture: 'Nurture',
  no_further_contact: 'No further contact',
  find_new_contact: 'Find a new contact',
  no_action: 'No action',
}

export function categoryLabel(c: string | null): string {
  return c ? CATEGORY_LABELS[c] ?? c : 'Unclassified'
}

export function intentLabel(intent: string | null): string {
  return intent ? INTENT_LABELS[intent] ?? intent : '—'
}

export function urgencyLabel(u: string | null): string {
  return u ? URGENCY_LABELS[u] ?? u : '—'
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence == null) return '—'
  if (confidence >= 0.75) return `High (${confidence.toFixed(2)})`
  if (confidence >= 0.5) return `Medium (${confidence.toFixed(2)})`
  return `Low (${confidence.toFixed(2)})`
}

export function nextActionLabel(a: string | null): string {
  return a ? NEXT_ACTION_LABELS[a] ?? a : '—'
}

/** "Selin Aydın" → "Selin"; the greeting prefix for a draft. */
export function firstName(fullName: string | null): string {
  if (!fullName) return 'there'
  return fullName.trim().split(/\s+/)[0] || fullName
}

/* ------------------------------------------------------------------ */
/* T9.6 — what "no further contact" permanently blocks                 */
/* ------------------------------------------------------------------ */

/**
 * The key written to suppression.email_or_domain. Prefer the buyer's email domain;
 * fall back to the company website domain. Both are matched by lib/contacts.ts's
 * isSuppressed() and lib/gmail.ts's assertNotSuppressed(), so once this key exists,
 * every future write to that buyer is refused by three independent paths.
 */
export function suppressKeyFor(email: string | null, website: string | null): string | null {
  const emailDomain = email?.split('@')[1]?.toLowerCase()
  if (emailDomain) return emailDomain
  return domainOf(website)
}

/* ------------------------------------------------------------------ */
/* T9.5 — the deterministic technical reply for a split reply          */
/* ------------------------------------------------------------------ */

export interface ReservedPoint {
  matter: string
  theirWords: string
}

export interface ReplyDraftInput {
  contactName: string | null
  senderName: string
  senderTitle: string
  answerable: string[]
  reserved: ReservedPoint[]
  authorityName: string
  market: string
  threadSubject: string
  /** Optional: the configured refusal template (T11.5). Defaults to the keyword-free one. */
  deferralTemplate?: string
}

export interface ReplyDraft {
  subject: string
  body: string
  /** How many reserved points were acknowledged (not answered). */
  deferredCount: number
}

/**
 * The technical half of a split reply, built deterministically rather than with a
 * fifth prompt.
 *
 * The triage prompt already separated what the export desk may answer from what it
 * may not. Answering the "answerable" half from published capability needs no model,
 * and the "reserved" half must never be answered by the export desk at all. So the
 * draft:
 *   1. thanks the buyer,
 *   2. commits to sending each answerable item,
 *   3. defers the reserved items with a single generic acknowledgement — the wording
 *      deliberately avoids every reserved keyword, because the guardrail scans for
 *      exactly those words and the export desk must not even name a price or a
 *      payment term,
 *   4. names the Commercial Authority who will answer the commercial half.
 *
 * Because this is a template, not a model call, it is also immune to the failure the
 * whole guardrail exists to catch: a model volunteering a commitment it was never
 * given data for. The body is asserted clean by tests/replies.test.ts.
 */
export function buildReplyDraft(input: ReplyDraftInput): ReplyDraft {
  const answerableLines = input.answerable.map((item) => {
    const clean = item.trim().replace(/\.+$/, '')
    return `I'll send you ${clean}.`
  })

  const lines: string[] = [`Dear ${firstName(input.contactName)},`, '', 'Thank you for writing back.']
  if (answerableLines.length) {
    lines.push('')
    lines.push(...answerableLines)
  }

  if (input.reserved.length) {
    lines.push('')
    lines.push(
      refusalFromTemplate(input.deferralTemplate ?? DEFAULT_REFUSAL_TEMPLATE, {
        authority: input.authorityName,
        market: input.market,
      }),
    )
  }

  lines.push('', 'Kind regards,', input.senderName, `${input.senderTitle}, Anwar Group`)

  return {
    subject: `Re: ${input.threadSubject.trim() || 'your enquiry'}`,
    body: lines.join('\n'),
    deferredCount: input.reserved.length,
  }
}

/**
 * The T9.5 rule in one testable predicate: a reply draft must never trip the
 * deterministic guardrail. If buildReplyDraft ever leaks a reserved keyword, this is
 * false and the test fails — which is exactly what we want, because that is a
 * commitment the export desk has no authority to make.
 */
export function replyDraftIsClean(draft: { body: string }): boolean {
  return scanPatterns(draft.body).length === 0
}
