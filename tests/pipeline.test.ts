/**
 * The pipeline move rules mirror the enforce_stage_gate trigger exactly. The one
 * behaviour worth testing is that a blocking task stops *forward* advancement but
 * never traps a lead in the board: sideways moves into holding lanes must stay open
 * so a blocked lead can still be disqualified or closed.
 */
import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STAGES,
  STAGE_ORDER,
  stageRank,
  moveBlockReason,
  leadTone,
  holdingLanesWithCounts,
} from '../lib/pipeline'

const CLEAR = { gapCount: 0, hasNamedContact: true, openBlockingTasks: 0 }

describe('stageRank', () => {
  it('orders the pipeline before the holding lanes', () => {
    expect(PIPELINE_STAGES).toHaveLength(9)
    expect(stageRank('commercial_discussion')).toBeGreaterThan(stageRank('qualification'))
    expect(stageRank('closed')).toBeGreaterThan(stageRank('commercial_discussion'))
    expect(stageRank('market_selection')).toBe(0)
    expect(STAGE_ORDER).toContain('nurture')
  })
})

describe('moveBlockReason', () => {
  it('allows an ordinary forward move with a clear context', () => {
    expect(moveBlockReason('qualification', 'contact_identification', CLEAR)).toBeNull()
  })

  it('blocks leaving qualification while a criterion is unverified', () => {
    const reason = moveBlockReason('qualification', 'contact_identification', {
      ...CLEAR,
      gapCount: 2,
    })
    expect(reason).toMatch(/2 qualification field/)
  })

  it('blocks moving into outreach without a named contact', () => {
    const reason = moveBlockReason('contact_identification', 'outreach', {
      ...CLEAR,
      hasNamedContact: false,
    })
    expect(reason).toMatch(/named decision-maker/)
  })

  it('blocks a forward move when a blocking task is open', () => {
    const reason = moveBlockReason('qualification', 'contact_identification', {
      ...CLEAR,
      openBlockingTasks: 1,
    })
    expect(reason).toMatch(/1 open task/)
  })

  it('still allows a sideways move into a holding lane despite an open blocking task', () => {
    expect(
      moveBlockReason('qualification', 'disqualified', {
        ...CLEAR,
        gapCount: 1,
        openBlockingTasks: 1,
        hasNamedContact: false,
      }),
    ).toBeNull()
  })
})

describe('leadTone', () => {
  it('marks reply, meeting and commercial discussion hot', () => {
    expect(leadTone('reply', 0)).toBe('hot')
    expect(leadTone('commercial_discussion', 0)).toBe('hot')
  })
})

describe('holdingLanesWithCounts', () => {
  it('attaches counts and keeps the canonical order', () => {
    const lanes = holdingLanesWithCounts({ disqualified: 3 })
    expect(lanes[0].key).toBe('needs_research')
    expect(lanes.find((l) => l.key === 'disqualified')?.count).toBe(3)
    expect(lanes.find((l) => l.key === 'nurturing')?.count).toBe(0)
  })
})
