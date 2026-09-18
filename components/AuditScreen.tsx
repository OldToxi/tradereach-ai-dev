'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { relativeTime } from '@/lib/contacts'
import {
  AUDIT_GROUPS,
  AUDIT_GROUP_LABELS,
  AUDIT_PAGE_SIZE,
  type AuditGroup,
  type AuditRowView,
} from '@/lib/audit-view'

export type { AuditRowView }

export function AuditScreen({
  rows,
  total,
  page,
  totalPages,
  group,
}: {
  rows: AuditRowView[]
  total: number
  page: number
  totalPages: number
  group: AuditGroup
}) {
  const router = useRouter()
  const params = useSearchParams()

  function go(next: { group?: AuditGroup; page?: number }) {
    const p = new URLSearchParams(params.toString())
    if (next.group && next.group !== 'all') p.set('group', next.group)
    else p.delete('group')
    if (next.page && next.page > 1) p.set('page', String(next.page))
    else p.delete('page')
    const qs = p.toString()
    router.push(qs ? `/audit?${qs}` : '/audit')
  }

  const from = total === 0 ? 0 : (page - 1) * AUDIT_PAGE_SIZE + 1
  const to = Math.min(page * AUDIT_PAGE_SIZE, total)

  return (
    <>
      <div className="pagehead">
        <div className="grow">
          <h1>Audit trail</h1>
          <p>
            Every action that could affect a buyer, a price, or a record: who did it,
            when, from where, and what the system held before and after.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="btn"
            value={group}
            onChange={(e) => go({ group: e.target.value as AuditGroup, page: 1 })}
          >
            {AUDIT_GROUPS.map((g) => (
              <option key={g} value={g}>
                {AUDIT_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
          <a className="btn" href={`/api/audit/export${group !== 'all' ? `?group=${group}` : ''}`}>
            Export
          </a>
        </div>
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Object</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No events match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap" title={r.createdAt}>
                      {relativeTime(r.createdAt)}
                    </td>
                    <td>{r.actorLabel}</td>
                    <td>{r.event}</td>
                    <td>{r.objectType ?? '—'}</td>
                    <td className="muted">{r.detail ?? ''}</td>
                    <td className="muted">{r.ip ?? ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="tiny muted"
        style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>
          Showing {from}–{to} of {total} events
        </span>
        {totalPages > 1 && (
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
              Prev
            </button>
            <span className="small" style={{ alignSelf: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn sm"
              disabled={page >= totalPages}
              onClick={() => go({ page: page + 1 })}
            >
              Next
            </button>
          </span>
        )}
      </div>

      <p className="tiny muted" style={{ marginTop: 10 }}>
        Audit rows are append-only. AI events store the model name, prompt version and
        token cost; approval events store a hash of the exact text approved, so a sent
        message can always be matched to what a person signed off.
      </p>
    </>
  )
}
