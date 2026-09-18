/**
 * lib/readout.ts — the weekly read-out (T10.7).
 *
 * Deterministic, not a fresh model call: AGENTS.md §5 fixes the build at "four prompts
 * only", and a workspace summary is aggregation, not new reasoning. The read-out is
 * generated on demand from live numbers, stored on `weekly_readout`, and stays
 * "unreviewed" until a human marks it reviewed — the review flow is the feature, the
 * prose is derived from data it can actually prove.
 */
import type { MarketBar } from './dashboard'

export interface ReadoutInput {
  researched: number
  newThisWeek: number
  qualified: number
  contacted: number
  replied: number
  replyRatePct: number
  meetings: number
  followUpsDue: number
  needsResearch: number
  marketBars: MarketBar[]
}

/** A data-driven weekly narrative. Every sentence is provable from the numbers given. */
export function buildWeeklyReadout(i: ReadoutInput): string {
  const top = i.marketBars[0]
  const last = i.marketBars[i.marketBars.length - 1]

  const lines: string[] = []

  lines.push(
    `This week the workspace moved from ${i.researched - i.newThisWeek} to ${i.researched} researched companies (+${i.newThisWeek} new). ${i.qualified} are qualified for outreach.`,
  )

  lines.push(
    `${i.contacted} companies are in active outreach, ${i.replied} have replied (${i.replyRatePct}% reply rate), and ${i.meetings} meeting${i.meetings === 1 ? ' is' : 's are'} on the calendar.`,
  )

  if (top && last && top.market !== last.market) {
    lines.push(
      `${top.market} leads the board with ${top.count} active compan${top.count === 1 ? 'y' : 'ies'}; ${last.market} has the least movement this week (${last.count}).`,
    )
  } else if (top) {
    lines.push(`${top.market} is the only active market this week with ${top.count} compan${top.count === 1 ? 'y' : 'ies'}.`)
  }

  const backlog: string[] = []
  if (i.followUpsDue) backlog.push(`${i.followUpsDue} follow-up${i.followUpsDue === 1 ? '' : 's'} due today`)
  if (i.needsResearch) backlog.push(`${i.needsResearch} compan${i.needsResearch === 1 ? 'y' : 'ies'} still blocked on qualification data`)
  if (backlog.length) {
    lines.push(`Suggested moves: clear ${backlog.join(' and ')} before starting new research.`)
  } else {
    lines.push('Suggested moves: no backlog — the board is clear, so the fastest win is new outreach on the highest-scoring uncontacted leads.')
  }

  return lines.join('\n\n')
}
