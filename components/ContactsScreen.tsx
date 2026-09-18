'use client'

import Link from 'next/link'
import { contactableStatus, relativeTime } from '@/lib/contacts'
import { provenanceClass, provenanceLabel } from '@/lib/company-facts'

export interface ContactRow {
  id: string
  fullName: string
  roleTitle: string | null
  companyId: string
  companyName: string
  market: string
  email: string | null
  emailSource: string | null
  provenance: string
  lawfulBasis: string | null
  isPrimary: boolean
  suppressed: boolean
  companyStage: string
  lastTouch: string | null
}

export function ContactsScreen({ contacts }: { contacts: ContactRow[] }) {
  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Decision-makers</h1>
          <p>
            People, not inboxes. Each contact carries where the address came from,
            whether it has been checked, and the lawful basis for writing to them.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Company</th>
                <th>Market</th>
                <th>Email</th>
                <th>Verification</th>
                <th>Lawful basis</th>
                <th>Contactable</th>
                <th>Last touch</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ padding: 18 }}>
                    No decision-makers found yet. Add one from a company&apos;s
                    Decision-makers tab.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const contactable = contactableStatus(c, {
                    companyStage: c.companyStage,
                    suppressed: c.suppressed,
                  })
                  return (
                    <tr key={c.id}>
                      <td>
                        <b>{c.fullName}</b>
                        {c.isPrimary ? (
                          <span className="tag tag-ok" style={{ marginLeft: 6 }}>
                            Primary
                          </span>
                        ) : null}
                      </td>
                      <td>{c.roleTitle ?? '—'}</td>
                      <td>
                        <Link href={`/companies/${c.companyId}`}>{c.companyName}</Link>
                      </td>
                      <td>{c.market}</td>
                      <td className="small mono">{c.email ?? '—'}</td>
                      <td>
                        <span className={`prov ${provenanceClass(c.provenance)}`}>
                          <i />
                          {provenanceLabel(c.provenance)}
                        </span>
                      </td>
                      <td className="small muted">{c.lawfulBasis ?? '—'}</td>
                      <td>
                        <span className={contactable.className}>{contactable.text}</span>
                      </td>
                      <td className="small muted">
                        {c.lastTouch ? relativeTime(c.lastTouch) : 'Never'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
