/**
 * lib/meetings.ts — pure helpers for meetings, tasks and the meeting brief (T10.1-T10.3).
 *
 * No Supabase, no cookies, no React, no Anthropic SDK. The meeting brief is assembled
 * deterministically from verified facts and the email thread (it must never be a fresh
 * model call — see AGENTS.md §5, "four prompts only", and the WORKLOG decision for T10.2).
 * The "do not commit" list is the canonical reserved-matter list from lib/guardrails.ts,
 * never the model's idea of what is commercial.
 */
import { RESERVED_MATTERS, RESERVED_LABELS } from './guardrails'

/** Times are entered and shown in the team/buyer timezone (GMT+6, fixed offset). */
export const MEETING_TZ = 'Asia/Dhaka'

/** Combines the modal's date + time (entered in GMT+6) into a stored ISO timestamp. */
export function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00+06:00`).toISOString()
}

export interface WhenParts {
  day: string
  time: string
  tz: string
}

export function formatWhen(startsAt: string): WhenParts {
  const d = new Date(startsAt)
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: MEETING_TZ }).format(d)
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MEETING_TZ,
  }).format(d)
  return { day, time, tz: 'GMT+6' }
}

/** The purpose options from the mock's schedule modal, keyed by whether commercial must attend. */
export const MEETING_PURPOSES = [
  { label: 'Introductory call', requiresCommercial: false },
  { label: 'Technical specification review', requiresCommercial: false },
  { label: 'Commercial discussion — requires Commercial Authority', requiresCommercial: true },
  { label: 'Factory visit planning', requiresCommercial: false },
] as const

export function purposeLabel(purpose: string | null): string {
  return purpose ?? 'Meeting'
}

/** The Prep cell: a commercial meeting has a hard attendance flag, anything else is "brief ready". */
export function meetingPrep(m: { brief: string | null; requires_commercial: boolean }): {
  label: string
  className: 'tag-ok' | 'tag-alert' | 'tag'
} {
  if (m.requires_commercial) return { label: 'Commercial Authority must attend', className: 'tag-alert' }
  if (m.brief) return { label: 'Brief ready', className: 'tag-ok' }
  return { label: 'Brief pending', className: 'tag' }
}

/** A short, deterministic due label for a task (`due_on` is a YYYY-MM-DD string). */
export function dueLabel(dueOn: string | null, now = new Date()): string {
  if (!dueOn) return ''
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 864e5).toISOString().slice(0, 10)
  if (dueOn === today) return 'due today'
  if (dueOn === tomorrow) return 'due tomorrow'
  if (dueOn < today) return 'overdue'
  const d = new Date(`${dueOn}T00:00:00Z`)
  return `due ${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(d)}`
}

export interface BriefInput {
  companyName: string
  market: string
  companyType: string | null
  /** The AI-written research summary, already stored and already AI-badged. */
  summary: string | null
  /** Open qualification gaps — what the room should ask about. */
  openQuestions: string[]
  /** The Commercial Authority's name, for the "refer to" line. */
  authorityName: string
  /** How many verified facts the brief was assembled from (shown in the footer). */
  verifiedFactCount: number
}

export interface BriefOutput {
  text: string
  verifiedCount: number
  doNotCommit: string[]
}

const FALLBACK_QUESTIONS = [
  'annual volumes and order patterns',
  'who signs off supplier changes',
  'what they need from a new supplier to move',
]

/**
 * The meeting brief. Deterministic by design: it restates what is already verified and
 * asks only the open questions, and it appends the canonical "do not commit" list so no
 * one improvises a commitment in the room. The summary, when present, is AI-written and
 * remains AI-badged wherever it is shown.
 */
export function buildMeetingBrief(input: BriefInput): BriefOutput {
  const questions = input.openQuestions.length ? input.openQuestions : FALLBACK_QUESTIONS

  const intro = input.summary
    ? input.summary.trim()
    : `${input.companyName} is a ${input.companyType ?? 'prospect'} in ${input.market}. No research summary is on file yet — run research before the call.`

  const ask = questions.map((q, i) => {
    const tail = i === questions.length - 1 ? '.' : i === questions.length - 2 ? ' and ' : ', '
    return `${q}${tail}`
  }).join('')

  const doNotCommit = RESERVED_MATTERS.map((m) => RESERVED_LABELS[m])

  const text = `${intro}

Ask them: ${ask}

Do not commit: ${doNotCommit.join(', ')}. Refer commercial questions to ${input.authorityName}.`

  return { text, verifiedCount: input.verifiedFactCount, doNotCommit }
}
