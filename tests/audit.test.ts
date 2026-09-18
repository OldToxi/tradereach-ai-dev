/**
 * The audit trail is append-only by database rule, not by app discipline. The one
 * behaviour worth proving is that the mechanism is real: the schema carries a
 * DO INSTEAD NOTHING rule on both UPDATE and DELETE, and RLS grants no write policy
 * at all. The group mapping and CSV format are then tested so the filter and export
 * stay faithful to the AUDIT vocabulary.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  AUDIT_GROUPS,
  auditGroupFor,
  auditGroupLabel,
  eventsInGroup,
  auditRowsToCsvBody,
  AUDIT_CSV_HEADER,
  ipToString,
  type AuditRowView,
} from '../lib/audit-view'

function auditVocabFromSource(): string[] {
  const src = readFileSync('lib/audit.ts', 'utf8')
  return [...src.matchAll(/[A-Z][A-Z_]*:\s*'([^']+)'/g)].map((m) => m[1])
}

describe('audit_event is append-only', () => {
  it('carries DO INSTEAD NOTHING rules on update and delete', () => {
    const schema = readFileSync('supabase/migrations/0001_schema.sql', 'utf8')
    expect(schema).toMatch(/create rule audit_no_update as on update to audit_event do instead nothing/)
    expect(schema).toMatch(/create rule audit_no_delete as on delete to audit_event do instead nothing/)
  })

  it('grants no insert, update or delete policy in RLS', () => {
    const rls = readFileSync('supabase/migrations/0002_rls.sql', 'utf8')
    expect(rls).toMatch(/create policy audit_read on audit_event for select/)
    expect(rls.match(/create policy \w+ on audit_event for (insert|update|delete)/g)).toBeNull()
  })
})

describe('audit filter groups', () => {
  it('maps the whole AUDIT vocabulary into exactly one non-all group', () => {
    const vocab = auditVocabFromSource()
    expect(vocab.length).toBeGreaterThan(0)
    for (const event of vocab) {
      expect(auditGroupFor(event)).not.toBe('all')
    }
  })

  it('leaves no gap and no overlap across the five groups', () => {
    const vocab = auditVocabFromSource()
    const union = AUDIT_GROUPS.filter((g) => g !== 'all').flatMap((g) => eventsInGroup(g))
    expect(union).toHaveLength(new Set(union).size) // no duplicate across groups
    expect(new Set(union)).toEqual(new Set(vocab)) // no missing event
  })

  it('buckets the demo events as the mock labels them', () => {
    expect(auditGroupFor('Approved outreach')).toBe('approvals')
    expect(auditGroupFor('Research run')).toBe('ai')
    expect(auditGroupFor('Field verified')).toBe('field_changes')
    expect(auditGroupFor('Gmail call failed')).toBe('connector')
    expect(auditGroupFor('Access refused')).toBe('access')
    expect(auditGroupFor('Some future event')).toBe('all')
    expect(auditGroupLabel('ai')).toBe('AI generations')
    expect(eventsInGroup('all')).toEqual([])
  })
})

describe('audit CSV export', () => {
  const row: AuditRowView = {
    id: 1,
    createdAt: '2026-09-18T10:00:00+00:00',
    actorLabel: 'Rifat Hasan',
    event: 'Approved outreach',
    objectType: 'message',
    objectId: 'a-b-c',
    detail: 'He said "yes", to the 8 lb count',
    ip: '192.0.2.1',
  }

  it('produces the header and one line per row', () => {
    expect(AUDIT_CSV_HEADER).toBe('time,actor,event,object_type,object_id,detail,ip')
    expect(auditRowsToCsvBody([row])).toBe(
      '2026-09-18T10:00:00+00:00,Rifat Hasan,Approved outreach,message,a-b-c,"He said ""yes"", to the 8 lb count",192.0.2.1',
    )
  })

  it('renders null fields as empty cells', () => {
    expect(auditRowsToCsvBody([{ ...row, detail: null, ip: null }])).toBe(
      '2026-09-18T10:00:00+00:00,Rifat Hasan,Approved outreach,message,a-b-c,,',
    )
  })
})

describe('ipToString', () => {
  it('normalises the inet column to a string or null', () => {
    expect(ipToString('192.0.2.1')).toBe('192.0.2.1')
    expect(ipToString(null)).toBeNull()
    expect(ipToString(undefined)).toBeNull()
    expect(ipToString({ toString: () => '10.0.0.1' })).toBe('10.0.0.1')
  })
})
