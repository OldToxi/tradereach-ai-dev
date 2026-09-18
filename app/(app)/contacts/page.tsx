import { createServerClient } from '@/lib/supabase/server'
import { isSuppressed } from '@/lib/contacts'
import { ContactsScreen, type ContactRow } from '@/components/ContactsScreen'

export default async function ContactsPage() {
  const supabase = await createServerClient()

  const [{ data: contacts, error }, { data: suppression }, { data: messages }, { data: replies }] =
    await Promise.all([
      supabase
        .from('contact')
        .select(
          'id, full_name, role_title, email, email_source, provenance, lawful_basis, is_primary, company_id, company:company_id(name, market, stage, website)',
        )
        .order('full_name'),
      supabase.from('suppression').select('email_or_domain'),
      supabase.from('message').select('contact_id, created_at').not('contact_id', 'is', null),
      supabase.from('reply').select('contact_id, received_at').not('contact_id', 'is', null),
    ])

  if (error) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Decision-makers</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>Could not load contacts: {error.message}</p>
        </div>
      </div>
    )
  }

  const suppressedSet = new Set((suppression ?? []).map((s) => s.email_or_domain.toLowerCase()))

  const lastTouch = new Map<string, string>()
  for (const m of messages ?? []) {
    if (!m.contact_id) continue
    const prev = lastTouch.get(m.contact_id)
    if (!prev || m.created_at > prev) lastTouch.set(m.contact_id, m.created_at)
  }
  for (const r of replies ?? []) {
    if (!r.contact_id) continue
    const prev = lastTouch.get(r.contact_id)
    if (!prev || r.received_at > prev) lastTouch.set(r.contact_id, r.received_at)
  }

  const rows: ContactRow[] = (contacts ?? [])
    .filter((c) => c.company)
    .map((c) => ({
      id: c.id,
      fullName: c.full_name,
      roleTitle: c.role_title,
      companyId: c.company_id,
      companyName: c.company!.name,
      market: c.company!.market,
      email: c.email,
      emailSource: c.email_source,
      provenance: c.provenance,
      lawfulBasis: c.lawful_basis,
      isPrimary: c.is_primary,
      suppressed: isSuppressed(c.email, c.company!.website, suppressedSet),
      companyStage: c.company!.stage,
      lastTouch: lastTouch.get(c.id) ?? null,
    }))

  return <ContactsScreen contacts={rows} />
}
