import { describe, it, expect } from 'vitest'
import { combineThread, type ThreadMessageInput, type ThreadReplyInput } from '../lib/thread'

const msg = (id: string, timestamp: string): ThreadMessageInput => ({
  id,
  subject: `subject ${id}`,
  body: `body ${id}`,
  approverName: 'Rifat Hasan',
  timestamp,
})

const reply = (id: string, timestamp: string): ThreadReplyInput => ({
  id,
  contactName: 'Selin Aydın',
  subject: `Re: ${id}`,
  body: `reply ${id}`,
  timestamp,
  isSimulated: false,
  category: null,
  intent: null,
  urgency: null,
  confidence: null,
  nextAction: null,
})

describe('combineThread', () => {
  it('merges outbound and inbound, newest first', () => {
    const thread = combineThread(
      [msg('a', '2026-09-14T09:05:00Z')],
      [reply('b', '2026-09-18T07:42:00Z')],
    )
    expect(thread.map((t) => t.direction)).toEqual(['in', 'out'])
  })

  it('tags outbound messages as "out" and inbound replies as "in"', () => {
    const thread = combineThread([msg('a', '2026-09-14T09:05:00Z')], [reply('b', '2026-09-18T07:42:00Z')])
    const out = thread.find((t) => t.direction === 'out')
    const inb = thread.find((t) => t.direction === 'in')
    expect(out && out.direction === 'out' && out.message.id).toBe('a')
    expect(inb && inb.direction === 'in' && inb.reply.id).toBe('b')
  })

  it('sorts a full interleaved thread by timestamp regardless of direction', () => {
    const thread = combineThread(
      [
        msg('m1', '2026-09-14T09:05:00Z'),
        msg('m2', '2026-09-16T11:00:00Z'),
      ],
      [reply('r1', '2026-09-15T08:00:00Z')],
    )
    expect(thread.map((t) => (t.direction === 'out' ? t.message.id : t.reply.id))).toEqual([
      'm2',
      'r1',
      'm1',
    ])
  })

  it('returns an empty thread when there is nothing on file', () => {
    expect(combineThread([], [])).toEqual([])
  })
})
