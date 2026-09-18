/**
 * lib/messages.ts — pure helpers for drafting, review and the follow-up cadence
 * (T7.1-T7.7). No Supabase, no cookies, no React, no Anthropic SDK: the rules that
 * decide word limits, pre-send checks, working-day cadence and claim/risk
 * highlighting are all plain functions so they can be unit-tested without a request,
 * a database or an AI call.
 *
 * THE STATE MACHINE (message.status), reasoned from the schema in 0001/0002:
 *
 *   A draft is inserted (by the AI draft runner, via the service role — the same
 *   pattern as ai_run/research_run) as 'awaiting_approval' if it is clean, or
 *   directly as 'held_commercial' if the guardrail found a reserved matter at
 *   creation time. RLS's message_insert policy only allows a *user* client to insert
 *   'draft'/'awaiting_approval' — 'held_commercial' can only be reached this way
 *   because the AI runner uses the service role, exactly like ai_run/research_run.
 *
 *   From 'awaiting_approval': any write-role user may approve (manager/commercial —
 *   message_update's "approving" branch requires can_approve()) or reject (the
 *   "ordinary editing" branch, any write role). Editing the text and re-running the
 *   guardrail can also send a held draft back to 'awaiting_approval' if the edit
 *   actually removed the reserved language — any write role can do this, because at
 *   that point there is genuinely nothing reserved left for a human to release.
 *
 *   From 'held_commercial': only a commercial-role user can write to it at all (RLS's
 *   "releasing a held draft" branch is `status = 'held_commercial' AND is_commercial()`,
 *   and it doesn't require the resulting row to differ from the row that matched it —
 *   the actor merely has to be commercial). Release sets `released_by`; the row's
 *   status stays 'held_commercial' until a separate approve step (any can_approve()
 *   user, including the same commercial user) moves it to 'approved'. The DB's
 *   `held_needs_release` CHECK is what actually enforces that a reserved-matter draft
 *   cannot become 'approved' without `released_by` set — RLS alone does not forbid a
 *   manager from trying, the CHECK constraint does.
 */

/* ------------------------------------------------------------------ */
/* Word limits (T7.1/T7.7's "under 140 / 90 / 50 words")               */
/* ------------------------------------------------------------------ */

export function wordLimitFor(kind: string, touchNumber: number): number {
  if (kind === 'first_touch') return 140
  if (kind === 'follow_up') return touchNumber >= 3 ? 50 : 90
  return 140
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/* ------------------------------------------------------------------ */
/* Working-day cadence (T7.7)                                          */
/* ------------------------------------------------------------------ */

/** Adds n working days (Mon-Fri) to a date, skipping weekends entirely. */
export function addWorkingDays(date: Date, n: number): Date {
  const d = new Date(date.getTime())
  let remaining = n
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) remaining--
  }
  return d
}

export interface Cadence {
  touch2Due: Date
  touch3Due: Date
}

/** Both offsets are from the FIRST touch, per the mock's send plan card. */
export function cadenceFor(firstTouchSentAt: Date): Cadence {
  return {
    touch2Due: addWorkingDays(firstTouchSentAt, 4),
    touch3Due: addWorkingDays(firstTouchSentAt, 11),
  }
}

export interface TouchHistoryItem {
  touchNumber: number
  createdAt: string
}

/**
 * Which touch (2 or 3) is next, or null when the cadence is exhausted (three touches
 * sent, or a reply arrived — replies are checked separately by the caller, since this
 * function only knows about the messages, not the replies. Follow-ups stop the moment
 * any reply exists, per T7.7 — the caller passes `hasReplied` to keep that rule here
 * as one visible branch instead of scattering the check across call sites.
 */
export function nextTouchNumber(history: TouchHistoryItem[], hasReplied: boolean): 2 | 3 | null {
  if (hasReplied) return null
  const sent = new Set(history.map((h) => h.touchNumber))
  if (!sent.has(1)) return null // no first touch yet — not a follow-up situation
  if (sent.has(3)) return null // cadence exhausted
  if (sent.has(2)) return 3
  return 2
}

export function isFollowupDue(cadence: Cadence, touch: 2 | 3, now: Date): boolean {
  const due = touch === 2 ? cadence.touch2Due : cadence.touch3Due
  return now >= due
}

/* ------------------------------------------------------------------ */
/* Pre-send checks (T7.4) — the nine checks from the mock               */
/* ------------------------------------------------------------------ */

export interface PreSendCheck {
  label: string
  status: 'ok' | 'block'
}

export interface PreSendInput {
  contact: { provenance: string; email: string | null } | null
  claimsUsed: Array<{ claim: string; fromFact: string }>
  unresolvedClaims: number // claims whose fromFact no longer matches a verified fact
  body: string
  kind: string
  touchNumber: number
  recipientAllowed: boolean
  withinSendWindow: boolean
  weeklySent: number
  weeklyCap: number
  guardrailClear: boolean
  released: boolean
  lawfulBasisRecorded: boolean
  suppressed: boolean
}

export function buildPreSendChecks(input: PreSendInput): PreSendCheck[] {
  const hasNamedContact =
    input.contact != null &&
    input.contact.email != null &&
    (input.contact.provenance === 'verified' || input.contact.provenance === 'human_approved')

  return [
    { label: 'Named decision-maker with a verified address', status: hasNamedContact ? 'ok' : 'block' },
    {
      label: 'Every claim traced to a verified source',
      status: input.claimsUsed.length > 0 && input.unresolvedClaims === 0 ? 'ok' : 'block',
    },
    { label: 'No unverified field used in the text', status: input.unresolvedClaims === 0 ? 'ok' : 'block' },
    {
      label: `Under ${wordLimitFor(input.kind, input.touchNumber)} words`,
      status: countWords(input.body) <= wordLimitFor(input.kind, input.touchNumber) ? 'ok' : 'block',
    },
    { label: 'Send window respected', status: input.withinSendWindow ? 'ok' : 'block' },
    { label: 'Recipient on the test-domain allowlist', status: input.recipientAllowed ? 'ok' : 'block' },
    {
      label: `Weekly cap not exceeded (${input.weeklySent} of ${input.weeklyCap})`,
      status: input.weeklySent < input.weeklyCap ? 'ok' : 'block',
    },
    {
      // A reserved matter that a Commercial Authority has released is no longer a
      // reason to block approval — that release IS the authorisation. The DB's
      // held_needs_release CHECK is what actually enforces this; this check just
      // needs to stop disagreeing with it once release has happened.
      label: 'No reserved commercial matter',
      status: input.guardrailClear || input.released ? 'ok' : 'block',
    },
    {
      label: 'Unsubscribe and lawful basis recorded',
      status: input.lawfulBasisRecorded && !input.suppressed ? 'ok' : 'block',
    },
  ]
}

/* ------------------------------------------------------------------ */
/* Send window parsing — "08:00-17:00 Europe/Berlin, Mon-Fri"          */
/* ------------------------------------------------------------------ */

const DAY_TOKENS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

export interface ParsedSendWindow {
  startMinutes: number
  endMinutes: number
  timeZone: string
  days: number[]
}

/** Returns null when the free-text field can't be parsed — callers should fail open. */
export function parseSendWindow(text: string | null): ParsedSendWindow | null {
  if (!text) return null
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/)
  const tzMatch = text.match(/[A-Za-z]+\/[A-Za-z_]+/)
  if (!timeMatch || !tzMatch) return null

  const days: number[] = []
  const dayRange = text.match(/([A-Za-z]{3})[a-z]*\s*[–-]\s*([A-Za-z]{3})/)
  if (dayRange) {
    const start = DAY_TOKENS[dayRange[1].slice(0, 3).toLowerCase()]
    const end = DAY_TOKENS[dayRange[2].slice(0, 3).toLowerCase()]
    if (start != null && end != null) {
      for (let d = start; ; d = (d + 1) % 7) {
        days.push(d)
        if (d === end) break
      }
    }
  }

  return {
    startMinutes: Number(timeMatch[1]) * 60 + Number(timeMatch[2]),
    endMinutes: Number(timeMatch[3]) * 60 + Number(timeMatch[4]),
    timeZone: tzMatch[0],
    days,
  }
}

/** Fails open (true) when the window can't be parsed — this is an operational
 *  courtesy check, not one of AGENTS.md's absolute rules, so an unparseable market
 *  note must not silently block every draft for that market. */
export function isWithinSendWindow(text: string | null, now: Date): boolean {
  const parsed = parseSendWindow(text)
  if (!parsed) return true
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: parsed.timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
    }).formatToParts(now)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3) ?? ''
    const weekday = DAY_TOKENS[weekdayStr]
    const minutes = hour * 60 + minute
    const dayOk = parsed.days.length === 0 || (weekday != null && parsed.days.includes(weekday))
    return dayOk && minutes >= parsed.startMinutes && minutes < parsed.endMinutes
  } catch {
    return true
  }
}

/* ------------------------------------------------------------------ */
/* Recipient allowlist — mirrors lib/gmail.ts#assertAllowedRecipient   */
/* without throwing, for use as a plain predicate in the checks list.  */
/* ------------------------------------------------------------------ */

export function recipientAllowed(email: string | null, pattern = process.env.ALLOWED_RECIPIENT_PATTERN ?? '%.test') {
  if (!email) return false
  const suffix = pattern.replace('%', '')
  return email.toLowerCase().endsWith(suffix.toLowerCase())
}

/* ------------------------------------------------------------------ */
/* Claim ("why") and risk highlighting for the review queue (T7.3)     */
/* ------------------------------------------------------------------ */

export interface HighlightSegment {
  text: string
  kind: 'plain' | 'why' | 'risk'
}

export interface Span {
  start: number
  end: number
}

/**
 * Best-effort: claimsUsed[].claim is the model's own paraphrase, not guaranteed to be
 * a verbatim substring, so a claim that can't be located in the body simply isn't
 * highlighted inline — it is still listed in the "Why this message" panel, so nothing
 * is lost, only the inline colour is approximate. Risk spans come from the guardrail's
 * own pattern-pass offsets, which ARE exact, and always win on overlap.
 */
export function highlightSegments(
  body: string,
  claims: Array<{ claim: string }>,
  riskSpans: Span[],
): HighlightSegment[] {
  const risk = [...riskSpans].sort((a, b) => a.start - b.start)

  const why: Span[] = []
  for (const c of claims) {
    if (!c.claim) continue
    const start = body.indexOf(c.claim)
    if (start === -1) continue
    const end = start + c.claim.length
    const overlapsRisk = risk.some((r) => start < r.end && end > r.start)
    const overlapsWhy = why.some((w) => start < w.end && end > w.start)
    if (!overlapsRisk && !overlapsWhy) why.push({ start, end })
  }

  const spans = [
    ...risk.map((s) => ({ ...s, kind: 'risk' as const })),
    ...why.map((s) => ({ ...s, kind: 'why' as const })),
  ].sort((a, b) => a.start - b.start)

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.start > cursor) segments.push({ text: body.slice(cursor, s.start), kind: 'plain' })
    segments.push({ text: body.slice(s.start, s.end), kind: s.kind })
    cursor = s.end
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), kind: 'plain' })
  return segments
}

/* ------------------------------------------------------------------ */
/* Claim resolution — has the fact a claim cites still got a source?   */
/*                                                                      */
/* `claimsUsed[].fromFact` is the model's own label for the fact it     */
/* cited (a fact key, or a product field name), not a foreign key — so  */
/* matching is approximate on purpose. This check deliberately          */
/* over-catches: flagging a legitimately-sourced claim costs a reviewer */
/* a second's confusion, missing an actually-unsourced one costs a      */
/* commitment the company didn't verify.                                */
/* ------------------------------------------------------------------ */

export function claimIsResolved(fromFact: string, verifiedKeys: string[], productFields: string[]): boolean {
  const needle = fromFact.toLowerCase().replace(/_/g, ' ').trim()
  if (!needle) return false
  return [...verifiedKeys, ...productFields].some((k) => {
    const h = k.toLowerCase().replace(/_/g, ' ').trim()
    return h.length > 0 && (needle.includes(h) || h.includes(needle))
  })
}

export function countUnresolvedClaims(
  claimsUsed: Array<{ fromFact: string }>,
  verifiedKeys: string[],
  productFields: string[],
): number {
  return claimsUsed.filter((c) => !claimIsResolved(c.fromFact, verifiedKeys, productFields)).length
}

/* ------------------------------------------------------------------ */
/* Approval hash (T7.5) — sha256 of the exact approved text            */
/* ------------------------------------------------------------------ */

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
