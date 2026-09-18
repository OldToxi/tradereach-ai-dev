import { describe, it, expect } from 'vitest'
import {
  messageLabel,
  repliedNextStep,
  touchDueLabel,
  sendLabel,
  computeOutreach,
} from '../lib/outreach'
import type { OutreachCompanyInput, OutreachMessageInput, OutreachReplyInput } from '../lib/outreach'

const NOW = new Date('2026-09-18T12:00:00Z') // a Friday

describe('messageLabel', () => {
  it('labels the first touch and numbers follow-ups', () => {
    expect(messageLabel('first_touch', 1)).toBe('First-touch')
    expect(messageLabel('follow_up', 2)).toBe('Follow-up 1')
    expect(messageLabel('follow_up', 3)).toBe('Follow-up 2')
  })
})

describe('repliedNextStep', () => {
  it('points an untriaged reply at the Replies screen', () => {
    expect(repliedNextStep(null)).toBe('Reply awaiting triage')
  })
  it('renders a known next action label, and passes unknowns through', () => {
    expect(repliedNextStep('escalate_commercial')).toBe('Escalate to commercial')
    expect(repliedNextStep('some_future_action')).toBe('some_future_action')
  })
})

describe('touchDueLabel', () => {
  it('classifies today, tomorrow, the past and a later weekday', () => {
    expect(touchDueLabel(new Date('2026-09-18T00:00:00Z'), NOW)).toEqual({
      text: 'due today',
      overdue: true,
    })
    expect(touchDueLabel(new Date('2026-09-19T00:00:00Z'), NOW)).toEqual({
      text: 'due tomorrow',
      overdue: false,
    })
    expect(touchDueLabel(new Date('2026-09-10T00:00:00Z'), NOW)).toEqual({
      text: 'overdue',
      overdue: true,
    })
    // 2026-09-21 is a Monday
    expect(touchDueLabel(new Date('2026-09-21T00:00:00Z'), NOW)).toEqual({
      text: 'due Mon',
      overdue: false,
    })
  })
})

describe('sendLabel', () => {
  it('formats a scheduled send as weekday + time', () => {
    expect(sendLabel('2026-09-22T09:10:00Z')).toBe('Tue 09:10')
  })
})

describe('computeOutreach', () => {
  const company = (over: Partial<OutreachCompanyInput> = {}): OutreachCompanyInput => ({
    id: over.id ?? 'c1',
    name: over.name ?? 'Acme',
    market: over.market ?? 'Türkiye',
    stage: over.stage ?? null,
    nextTouchAt: over.nextTouchAt ?? null,
  })

  const sent = (over: Partial<OutreachMessageInput> = {}): OutreachMessageInput => ({
    companyId: 'c1',
    contactName: 'Selin Aydın',
    kind: 'first_touch',
    touchNumber: 1,
    subject: 'Consistent jute yarn',
    status: 'sent',
    approverName: 'Rifat Hasan',
    approvedAt: '2026-09-04T00:00:00Z',
    scheduledFor: null,
    createdAt: '2026-09-03T00:00:00Z',
    ...over,
  })

  it('shows a replied thread with the triage next step', () => {
    const rows = computeOutreach(
      [company()],
      [sent()],
      [{ companyId: 'c1', nextAction: 'escalate_commercial', receivedAt: '2026-09-10T00:00:00Z' }],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('replied')
    expect(rows[0].statusLabel).toBe('Replied')
    expect(rows[0].nextStep).toBe('Escalate to commercial')
  })

  it('shows an untriaged reply as awaiting triage', () => {
    const rows = computeOutreach(
      [company()],
      [sent()],
      [{ companyId: 'c1', nextAction: null, receivedAt: '2026-09-10T00:00:00Z' }],
      NOW,
    )
    expect(rows[0].nextStep).toBe('Reply awaiting triage')
  })

  it('shows an approved-but-unsent message as ready to send', () => {
    const rows = computeOutreach(
      [company()],
      [sent({ status: 'approved', approvedAt: null })],
      [],
      NOW,
    )
    expect(rows[0].status).toBe('approved')
    expect(rows[0].nextStep).toBe('Ready to send')
  })

  it('computes an overdue follow-up from the cadence', () => {
    const rows = computeOutreach([company()], [sent()], [], NOW)
    expect(rows[0].status).toBe('awaiting_reply')
    expect(rows[0].statusLabel).toBe('No reply')
    expect(rows[0].tone).toBe('due')
    expect(rows[0].nextStep).toBe('Follow-up 1 overdue')
  })

  it('surfaces a next-touch company with no message thread', () => {
    const rows = computeOutreach(
      [company({ id: 'c2', name: 'Sahara', nextTouchAt: NOW.toISOString() })],
      [],
      [],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('follow_up_due')
    expect(rows[0].nextStep).toBe('Follow-up due today')
    expect(rows[0].tone).toBe('due')
  })

  it('labels a nurture-stage next touch as nurture', () => {
    const rows = computeOutreach(
      [company({ id: 'c3', name: 'Verde', stage: 'nurture', nextTouchAt: '2026-11-02T00:00:00Z' })],
      [],
      [],
      NOW,
    )
    expect(rows[0].statusLabel).toBe('Nurture scheduled')
    expect(rows[0].messageLabel).toBe('Nurture touch')
    expect(rows[0].nextStep).toContain('Nurture touch')
  })

  it('sorts overdue follow-ups above replied threads', () => {
    const companies = [
      company({ id: 'c1', name: 'Yıldız' }),
      company({ id: 'c2', name: 'Sahara', nextTouchAt: NOW.toISOString() }),
    ]
    const messages = [sent({ companyId: 'c1' })]
    const replies: OutreachReplyInput[] = [
      { companyId: 'c1', nextAction: null, receivedAt: '2026-09-10T00:00:00Z' },
    ]
    const rows = computeOutreach(companies, messages, replies, NOW)
    expect(rows.map((r) => r.company)).toEqual(['Sahara', 'Yıldız'])
  })

  it('ignores a next-touch that already has a reply', () => {
    const companies = [company({ id: 'c1', nextTouchAt: NOW.toISOString() })]
    const rows = computeOutreach(
      companies,
      [sent()],
      [{ companyId: 'c1', nextAction: null, receivedAt: '2026-09-10T00:00:00Z' }],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('replied')
  })
})
