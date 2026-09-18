/**
 * Settings → AI workflow (T11.4). The ten-step table must reflect the *real* prompt
 * specs, not a hardcoded copy that could drift. These tests pin the mapping: ten
 * steps, every step backed by one of the four prompts, versions and models read from
 * lib/ai/prompts and lib/ai/models.
 */
import { describe, it, expect } from 'vitest'
import { WORKFLOW_STEPS } from '../lib/ai/workflow'

describe('WORKFLOW_STEPS', () => {
  it('lists the ten steps from the mock', () => {
    expect(WORKFLOW_STEPS.map((s) => s.step)).toEqual([
      'Research summary',
      'Gap detection',
      'Suitability call',
      'Prioritisation',
      'Decision-maker pick',
      'Opportunity summary',
      'Outreach draft',
      'Follow-up draft',
      'Reply classification',
      'Next-action call',
    ])
  })

  it('reads versions and model names from the real prompt specs', () => {
    for (const s of WORKFLOW_STEPS) {
      expect(s.version).toMatch(/^v\d+$/)
      expect(s.model.length).toBeGreaterThan(0)
      expect(s.maxTokens).toBeGreaterThan(0)
      expect(['drafting', 'classify']).toContain(s.tier)
    }
  })

  it('assigns each step to one of the four prompts', () => {
    const names = new Set(WORKFLOW_STEPS.map((s) => s.promptName))
    expect([...names].sort()).toEqual(['draft', 'followup', 'research', 'triage'])
  })

  it('maps the six research capabilities onto the research prompt', () => {
    const research = WORKFLOW_STEPS.filter((s) => s.promptName === 'research')
    expect(research).toHaveLength(6)
    // All six share the same version — one prompt, one version, not six copies.
    expect(new Set(research.map((s) => s.version)).size).toBe(1)
  })
})
