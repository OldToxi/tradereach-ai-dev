import type { OutreachRow } from '@/lib/outreach'

const TONE_CLASS: Record<OutreachRow['tone'], string> = {
  ok: 'tag-ok',
  due: 'tag-due',
  plain: 'tag',
}

export function OutreachScreen({ rows }: { rows: OutreachRow[] }) {
  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Sent &amp; follow-ups</h1>
          <p>
            Approved messages, where each one stands, and what the system will do next if
            nobody replies.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Message</th>
                <th>Approved by</th>
                <th>Status</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 18 }}>
                    Nothing sent yet. Drafts leave the review queue and show up here once they
                    are approved and sent.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.companyId}>
                    <td>
                      <b>{r.company}</b>
                      <div className="small muted">{r.market}</div>
                    </td>
                    <td className="small">{r.contact ?? '—'}</td>
                    <td>
                      <div className="small">{r.messageLabel}</div>
                      {r.subject ? <div className="small muted">{r.subject}</div> : null}
                    </td>
                    <td className="small">{r.approver ?? '—'}</td>
                    <td>
                      <span className={`tag ${TONE_CLASS[r.tone]}`}>{r.statusLabel}</span>
                    </td>
                    <td className="small">{r.nextStep}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
