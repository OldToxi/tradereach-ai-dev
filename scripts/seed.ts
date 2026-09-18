/**
 * scripts/seed.ts — the demo's starting state.
 *
 * Run:  npm run seed          (idempotent; safe to re-run)
 *       npm run seed -- --reset   (wipes app data first, keeps auth users)
 *
 * This is not decoration. The brief's section 6 asks for a connected journey where
 * a lead is already mid-conversation, so the demo must open on a workspace with
 * history in it. Recording a video against an empty database means spending the
 * first four minutes typing.
 *
 * Data is lifted from design/mock-ui.html, so the built app and the mock agree.
 */
import { admin } from '../lib/supabase/admin'
import type { Database } from '../lib/database.types'

type UserRole = Database['public']['Enums']['user_role']
type Stage = Database['public']['Enums']['stage']
type Provenance = Database['public']['Enums']['provenance']

const TEAM: Array<{ email: string; name: string; role: UserRole; markets: string[] }> = [
  { email: 'rifat.hasan@anwargroup.test', name: 'Rifat Hasan', role: 'manager', markets: ['Türkiye', 'Germany', 'United Kingdom'] },
  { email: 'nusrat.jahan@anwargroup.test', name: 'Nusrat Jahan', role: 'executive', markets: ['Japan', 'UAE'] },
  { email: 'tanvir.alam@anwargroup.test', name: 'Tanvir Alam', role: 'executive', markets: ['Brazil', 'Egypt'] },
  { email: 'mahbub.rahman@anwargroup.test', name: 'Mahbub Rahman', role: 'commercial', markets: [] },
  { email: 'audit@anwargroup.test', name: 'Audit (internal)', role: 'auditor', markets: [] },
]

const PASSWORD = process.env.SEED_PASSWORD ?? 'demo-password-2026'

const PRODUCTS = [
  {
    name: 'Jute yarn',
    hs_code: '5307.10',
    certifications: ['OEKO-TEX', 'ISO 9001'],
    monthly_capacity: '920 MT',
    lead_time: '28–35 days ex-Chittagong',
    // Note what is NOT here: price, MOQ, payment terms, sample policy. A model
    // cannot quote what it has never been given. See lib/ai/context.ts.
    capability_sheet:
      'Counts 4 lb to 20 lb, single and twisted. Hessian-wrapped bales of 200 kg. Every bale tested against declared count before dispatch. Ships from Chittagong.',
  },
  { name: 'Woven jute bags', hs_code: '6305.10', certifications: ['OEKO-TEX', 'BSCI'], monthly_capacity: '1.4M pcs', lead_time: '30–40 days ex-Chittagong', capability_sheet: 'Plain and laminated hessian. Printing up to four colours. Sizes made to specification.' },
  { name: 'Knit garments', hs_code: '6109.10', certifications: ['BSCI', 'ISO 14001'], monthly_capacity: '2.1M pcs', lead_time: '45–60 days ex-Chittagong', capability_sheet: 'Single jersey, pique, interlock. In-house knitting and dyeing.' },
  { name: 'Ceramic tableware', hs_code: '6912.00', certifications: ['LFGB', 'FDA'], monthly_capacity: '480 MT', lead_time: '40–55 days ex-Chittagong', capability_sheet: 'Stoneware and porcelain. Decal and hand-paint decoration.' },
]

const MARKETS = [
  { country: 'Türkiye', product_focus: 'Jute yarn', import_demand: '48,200 MT/yr', tariff_note: '0% GSP', priority: 'high', weekly_outreach_cap: 12, send_window: '08:00–17:00 Europe/Istanbul, Mon–Fri', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'KVKK (GDPR-aligned) applies. Lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'active' },
  { country: 'Germany', product_focus: 'Jute yarn, bags', import_demand: '31,600 MT/yr', tariff_note: '0% EBA', priority: 'high', weekly_outreach_cap: 12, send_window: '08:00–17:00 Europe/Berlin, Mon–Fri', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'GDPR applies. Contact must have a lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'active' },
  { country: 'Japan', product_focus: 'Jute yarn, tableware', import_demand: '12,900 MT/yr', tariff_note: '0% GSP', priority: 'high', weekly_outreach_cap: 10, send_window: '09:00–17:00 Asia/Tokyo, Mon–Fri', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'APPI applies. Opt-out recorded; unsubscribe honoured permanently.', status: 'active' },
  { country: 'United Kingdom', product_focus: 'Bags, garments', import_demand: '22,400 MT/yr', tariff_note: '0% DCTS', priority: 'medium', weekly_outreach_cap: 10, send_window: '08:00–17:00 Europe/London, Mon–Fri', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'UK GDPR applies. Lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'active' },
  { country: 'UAE', product_focus: 'Bags, tableware', import_demand: '9,800 MT/yr', tariff_note: '5% GCC', priority: 'medium', weekly_outreach_cap: 8, send_window: '08:00–16:00 Asia/Dubai, Sun–Thu', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'UAE PDPL applies. Consent or lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'under_review' },
  { country: 'Brazil', product_focus: 'Garments, tableware', import_demand: '6,200 MT/yr', tariff_note: '18% MFN', priority: 'watch', weekly_outreach_cap: 5, send_window: '09:00–17:00 America/Sao_Paulo, Mon–Fri', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'LGPD applies. Lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'watchlist' },
  { country: 'Egypt', product_focus: 'Jute yarn', import_demand: '4,100 MT/yr', tariff_note: 'Import licence required', priority: 'watch', weekly_outreach_cap: 5, send_window: '09:00–16:00 Africa/Cairo, Sun–Thu', required_before_sending: 'Named decision-maker · one verified trade source · product fit stated in the first two lines', legal_note: 'Egyptian PDPL applies. Lawful-interest basis recorded; unsubscribe honoured permanently.', status: 'paused' },
]

/**
 * Market notes carry provenance like company facts (rule 1). The optional fourth
 * element is the badge label — "UN Comtrade 2025", "AI inferred from 9 replies" —
 * matching the mock's market-note card. Notes without a label render no badge.
 */
const MARKET_NOTES: Record<string, Array<[string, string, Provenance, string?]>> = {
  'Türkiye': [
    ['why_this_market', 'Second-largest buyer of Bangladeshi jute yarn; local spinners short on raw supply.', 'human_approved'],
    ['import_volume', '48,200 MT / yr', 'verified', 'UN Comtrade 2025'],
    ['duty', '0% under GSP', 'unverified', 'Needs re-check for 2026'],
    ['buying_season', 'Orders cluster Jan–Mar', 'ai', 'AI inferred from 9 replies'],
    ['language', 'English accepted; Turkish opener lifts reply rate', 'human_approved'],
    ['local_rules', 'Include company registration number in first contact', 'human_approved'],
  ],
  'Germany': [
    ['why_this_market', 'Largest EU jute importer; steady demand for agri-packaging and food-grade hessian.', 'human_approved'],
    ['import_volume', '31,600 MT / yr', 'verified', 'UN Comtrade 2025'],
    ['duty', '0% under EBA (LDC)', 'verified', 'EU GSP database'],
    ['buying_season', 'Steady year-round; pre-harvest spike Aug–Oct', 'ai', 'AI inferred from 11 replies'],
    ['local_rules', 'EUDR due-diligence statement expected on first contact', 'human_approved'],
  ],
  'Japan': [
    ['why_this_market', 'High-value market that pays for count consistency and certified inputs.', 'human_approved'],
    ['import_volume', '12,900 MT / yr', 'verified', 'UN Comtrade 2025'],
    ['duty', '0% GSP', 'verified', 'Japan customs schedule'],
    ['local_rules', 'Japanese-language opener strongly preferred', 'human_approved'],
  ],
  'United Kingdom': [
    ['why_this_market', 'Duty-free DCTS access; growing demand for reusable retail bags.', 'human_approved'],
    ['import_volume', '22,400 MT / yr', 'verified', 'HMRC trade stats 2025'],
    ['duty', '0% DCTS', 'verified', 'UK Global Tariff'],
  ],
  'UAE': [
    ['why_this_market', 'MENA re-export hub; tableware and bags move through Dubai.', 'human_approved'],
    ['import_volume', '9,800 MT / yr', 'unverified', 'Estimated from re-export flows'],
    ['duty', '5% GCC', 'verified', 'GCC common tariff'],
  ],
  'Brazil': [
    ['why_this_market', 'Large domestic market; tariff-heavy, suits only higher-value lines.', 'human_approved'],
    ['import_volume', '6,200 MT / yr', 'unverified', 'Estimated'],
    ['duty', '18% MFN', 'verified', 'Brazil import tariff (TEC)'],
  ],
  'Egypt': [
    ['why_this_market', 'Import-licence regime; paused until licensing is confirmed.', 'human_approved'],
    ['import_volume', '4,100 MT / yr', 'unverified', 'Estimated'],
    ['duty', 'Import licence required', 'human_approved'],
  ],
}

/** stage values match the `stage` enum in 0001_schema.sql */
const COMPANIES: Array<{ key: string; name: string; website: string; market: string; company_type: string; stage: Stage; fit_score: number; owner: string }> = [
  { key: 'yildiz', name: 'Yıldız Tekstil A.Ş.', website: 'yildiztekstil.test', market: 'Türkiye', company_type: 'Converter', stage: 'commercial_discussion', fit_score: 91, owner: 'rifat.hasan@anwargroup.test' },
  { key: 'nordfiber', name: 'NordFiber Handels GmbH', website: 'nordfiber.test', market: 'Germany', company_type: 'Importer', stage: 'outreach', fit_score: 87, owner: 'rifat.hasan@anwargroup.test' },
  { key: 'atlas', name: 'Atlas Home Textiles Ltd', website: 'atlastextiles.test', market: 'United Kingdom', company_type: 'Retail buyer', stage: 'meeting', fit_score: 84, owner: 'rifat.hasan@anwargroup.test' },
  { key: 'kyoto', name: 'Kyoto Green Materials K.K.', website: 'kyotogreen.test', market: 'Japan', company_type: 'Distributor', stage: 'qualification', fit_score: 78, owner: 'nusrat.jahan@anwargroup.test' },
  { key: 'sahara', name: 'Sahara Packaging LLC', website: 'saharapack.test', market: 'UAE', company_type: 'Converter', stage: 'follow_up', fit_score: 66, owner: 'nusrat.jahan@anwargroup.test' },
  { key: 'bosphorus', name: 'Bosphorus Ambalaj San.', website: 'bosphorusambalaj.test', market: 'Türkiye', company_type: 'Converter', stage: 'follow_up', fit_score: 73, owner: 'rifat.hasan@anwargroup.test' },
  { key: 'verde', name: 'Verde Embalagens Ltda', website: 'verdeemb.test', market: 'Brazil', company_type: 'Distributor', stage: 'nurture', fit_score: 58, owner: 'tanvir.alam@anwargroup.test' },
  { key: 'hansa', name: 'Hansa Agrar Handel', website: 'hansaagrar.test', market: 'Germany', company_type: 'Trading house', stage: 'contact_identification', fit_score: 81, owner: 'rifat.hasan@anwargroup.test' },
  { key: 'nileco', name: 'NileCo Trading', website: 'nileco.test', market: 'Egypt', company_type: 'Importer', stage: 'disqualified', fit_score: 39, owner: 'tanvir.alam@anwargroup.test' },
  { key: 'osaka', name: 'Osaka Agri Textiles', website: 'osakaagri.test', market: 'Japan', company_type: 'Converter', stage: 'reply', fit_score: 76, owner: 'nusrat.jahan@anwargroup.test' },
  { key: 'gulfpack', name: 'Gulf Pack Industries', website: 'gulfpack.test', market: 'UAE', company_type: 'Converter', stage: 'company_research', fit_score: 52, owner: 'nusrat.jahan@anwargroup.test' },
  { key: 'thames', name: 'Thames Eco Supply Co.', website: 'thameseco.test', market: 'United Kingdom', company_type: 'Distributor', stage: 'qualification', fit_score: 69, owner: 'rifat.hasan@anwargroup.test' },
]

/**
 * Which product each company is being worked for. The catalog screen derives
 * "Active leads" from this. Kept as a map on the company key so a single company
 * can be re-pointed without touching the array below.
 */
const PRODUCT_BY_KEY: Record<string, string> = {
  yildiz: 'Jute yarn',
  nordfiber: 'Jute yarn',
  atlas: 'Woven jute bags',
  kyoto: 'Jute yarn',
  sahara: 'Woven jute bags',
  bosphorus: 'Woven jute bags',
  verde: 'Woven jute bags',
  hansa: 'Jute yarn',
  nileco: 'Jute yarn',
  osaka: 'Jute yarn',
  gulfpack: 'Woven jute bags',
  thames: 'Knit garments',
}

/** [key, value, provenance, isQualificationCriterion] */
const FACTS: Record<string, Array<[string, string, 'verified' | 'unverified' | 'ai' | 'human_approved', boolean]>> = {
  yildiz: [
    ['legal_name', 'Yıldız Tekstil Sanayi ve Ticaret A.Ş.', 'verified', false],
    ['registration', 'İzmir Ticaret Sicil 44192-K', 'verified', false],
    ['imports_category', 'Imports jute — 12,400 MT in 2025', 'verified', true],
    ['buys_south_asia', 'Two Indian mills', 'verified', true],
    ['volume_fit', '~1,030 MT/month against our 920 MT capacity', 'verified', true],
    ['certification_match', 'Requires OEKO-TEX, which we hold', 'verified', true],
    ['decision_maker_found', 'Selin Aydın, Sourcing Manager', 'verified', true],
    ['credit_signal', 'No data', 'unverified', true],
    ['employees', '~340', 'unverified', false],
    ['annual_revenue', '~USD 48M', 'unverified', false],
    ['current_suppliers', 'Split across two Indian mills', 'ai', false],
    ['screening', 'Clear — no sanctions match', 'verified', false],
    ['analyst_note', 'Met their export manager at Dhaka Int’l Trade Fair 2025. They were sampling hessian from two Indian mills and complained about inconsistent counts. Lead with consistency, not price. — Nusrat Jahan, 4 Sep', 'human_approved', false],
  ],
  nordfiber: [
    ['imports_category', 'Imported ~2,900 MT of jute goods last year', 'verified', true],
    ['product_line', 'Lists hessian liners for agri-packaging', 'verified', false],
    ['certification_match', 'OEKO-TEX on their supplier requirements page', 'verified', true],
    ['registration', 'Handelsregister HRB 88214', 'verified', false],
    ['decision_maker_found', 'Lena Brauer, Head of Procurement', 'verified', true],
    ['buys_south_asia', 'India and Bangladesh, per trade data', 'verified', true],
    ['volume_fit', 'Approximately 240 MT/month', 'verified', true],
  ],
  kyoto: [
    ['imports_category', 'Claimed on their site, unconfirmed', 'unverified', true],
    ['importer_licence', 'Not found', 'unverified', true],
    ['annual_volume', 'Unknown', 'unverified', true],
    ['decision_maker_found', 'Aiko Tanaka, Import Division Lead', 'unverified', true],
    ['certification_match', 'JAS organic preferred', 'verified', true],
    ['product_line', 'Garden and agri-textile distribution', 'verified', false],
  ],
}

const CONTACTS: Array<{ company: string; full_name: string; role_title: string; email: string; email_source: string; provenance: Provenance; lawful_basis: string; is_primary: boolean }> = [
  { company: 'yildiz', full_name: 'Selin Aydın', role_title: 'Sourcing Manager', email: 's.aydin@yildiztekstil.test', email_source: 'Company site, supplier enquiry page', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'yildiz', full_name: 'Murat Yıldız', role_title: 'Managing Director', email: 'm.yildiz@yildiztekstil.test', email_source: 'Registry filing', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: false },
  { company: 'nordfiber', full_name: 'Lena Brauer', role_title: 'Head of Procurement', email: 'l.brauer@nordfiber.test', email_source: 'Company site, team page', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'atlas', full_name: 'Priya Raman', role_title: 'Head of Sourcing', email: 'p.raman@atlastextiles.test', email_source: 'Introduced at trade fair', provenance: 'verified', lawful_basis: 'Consent given at trade fair', is_primary: true },
  { company: 'kyoto', full_name: 'Aiko Tanaka', role_title: 'Import Division Lead', email: 'a.tanaka@kyotogreen.test', email_source: 'Guessed pattern — unverified', provenance: 'unverified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'sahara', full_name: 'Omar Farouk', role_title: 'Purchasing Officer', email: 'o.farouk@saharapack.test', email_source: 'Directory listing', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'osaka', full_name: 'Kenji Mori', role_title: 'Materials Buyer', email: 'k.mori@osakaagri.test', email_source: 'Company site', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'bosphorus', full_name: 'Emre Koç', role_title: 'Procurement Lead', email: 'e.koc@bosphorusambalaj.test', email_source: 'Company site', provenance: 'verified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'verde', full_name: 'Camila Souza', role_title: 'Commercial Director', email: 'c.souza@verdeemb.test', email_source: 'Directory listing', provenance: 'unverified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
  { company: 'thames', full_name: 'Harriet Doyle', role_title: 'Buying Manager', email: 'h.doyle@thameseco.test', email_source: 'Guessed pattern — unverified', provenance: 'unverified', lawful_basis: 'Legitimate interest — B2B, relevant product', is_primary: true },
]

const SOURCES = [
  { company: 'yildiz', title: 'İzmir Ticaret Sicil record', source_type: 'Registry', quality: 'primary' },
  { company: 'yildiz', title: 'UN Comtrade HS 5307 import flows', source_type: 'Trade data', quality: 'primary' },
  { company: 'yildiz', title: 'yildiztekstil.test/products', source_type: 'Company site', quality: 'primary' },
  { company: 'yildiz', title: 'Tekstil Dünyası interview with production director', source_type: 'Trade press', quality: 'secondary' },
  { company: 'yildiz', title: 'B2B directory listing', source_type: 'Directory', quality: 'weak' },
  { company: 'nordfiber', title: 'Handelsregister extract', source_type: 'Registry', quality: 'primary' },
  { company: 'nordfiber', title: 'nordfiber.test/agri-packaging', source_type: 'Company site', quality: 'primary' },
  { company: 'kyoto', title: 'kyotogreen.test/about', source_type: 'Company site', quality: 'secondary' },
]

const DRAFT_BODY = `Dear Ms Brauer,

Your team lists hessian liners for the agri-packaging range, and NordFiber imported roughly 2,900 MT of jute goods last year — so you will already know how much the count varies between mills.

Anwar Group spins jute yarn in Chittagong from 4 lb to 20 lb, OEKO-TEX certified, with 920 MT of monthly capacity held for export. What buyers usually tell us matters is that count stays where it should across shipments, and we test every bale against the declared count before it leaves the mill.

I can arrange a sample of the 8 lb count for your lab this month.

May I ask one question: are you specifying liners by count, or by finished bag weight? The answer changes what I should send you.

Kind regards,
Rifat Hasan
Export Development, Anwar Group`

const YILDIZ_SENT = `Dear Ms Aydın,

Your production director told Tekstil Dünyası that supply consistency is the problem you keep running into. That is the thing we build for.

Anwar Group spins jute yarn in Chittagong from 4 lb to 20 lb, OEKO-TEX certified, and every bale is tested against the declared count before it leaves the mill.

May I ask which counts your agricultural line runs on?

Kind regards,
Rifat Hasan
Export Development, Anwar Group`

const YILDIZ_REPLY = `Hello Rifat,

Thank you for writing. Your timing is good — we are reviewing our yarn supply for the first quarter and count consistency has been a real problem for us.

Could you send the technical specification for the 8 lb count? And what would your price per tonne be, CIF İzmir, for roughly 60 MT a month? We would also need to understand payment terms before going further.

Best regards,
Selin Aydın
Sourcing Manager, Yıldız Tekstil A.Ş.`

/* ------------------------------------------------------------------ */

const ids = { users: {} as Record<string, string>, products: {} as Record<string, string>, companies: {} as Record<string, string>, contacts: {} as Record<string, string> }

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

async function seedUsers() {
  for (const u of TEAM) {
    const { data: existing } = await admin.from('profiles').select('id').eq('email', u.email).maybeSingle()
    if (existing) {
      ids.users[u.email] = existing.id
      await admin.from('profiles').update({ role: u.role, assigned_markets: u.markets }).eq('id', existing.id)
      continue
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    })
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`)

    ids.users[u.email] = data.user.id
    // Depending on how you wire the profiles trigger, this may be an insert or an
    // update. upsert covers both without a branch.
    const { error: pErr } = await admin.from('profiles').upsert({
      id: data.user.id,
      email: u.email,
      full_name: u.name,
      role: u.role,
      assigned_markets: u.markets,
    })
    if (pErr) throw new Error(`profile ${u.email}: ${pErr.message}`)
    console.log(`  user ${u.email} (${u.role})`)
  }
}

async function seedCatalog() {
  // `product` has no unique constraint on `name` (unlike `market.country`), so an
  // `onConflict: 'name'` upsert errors with "no unique or exclusion constraint" and
  // silently leaves the table empty. Select-then-write instead.
  for (const p of PRODUCTS) {
    const { data: existing } = await admin.from('product').select('id').eq('name', p.name).maybeSingle()
    if (existing) {
      ids.products[p.name] = existing.id
      const { error } = await admin.from('product').update(p).eq('id', existing.id)
      if (error) throw new Error(`product ${p.name}: ${error.message}`)
    } else {
      const { data, error } = await admin.from('product').insert(p).select('id').single()
      if (error) throw new Error(`product ${p.name}: ${error.message}`)
      ids.products[p.name] = data.id
    }
  }
  const { error: mErr } = await admin.from('market').upsert(MARKETS, { onConflict: 'country' })
  if (mErr) throw new Error(`markets: ${mErr.message}`)
  console.log(`  ${PRODUCTS.length} products, ${MARKETS.length} markets`)
}

async function seedMarketNotes() {
  const { data: markets } = await admin.from('market').select('id, country')
  const idByCountry: Record<string, string> = {}
  for (const m of markets ?? []) idByCountry[m.country] = m.id

  let count = 0
  for (const [country, notes] of Object.entries(MARKET_NOTES)) {
    const marketId = idByCountry[country]
    if (!marketId) throw new Error(`market note: no market "${country}"`)
    for (const [key, value, provenance, sourceLabel] of notes) {
      const { error } = await admin.from('market_note').upsert(
        { market_id: marketId, key, value, provenance, source_label: sourceLabel ?? null },
        { onConflict: 'market_id,key' },
      )
      if (error) throw new Error(`market note ${country}/${key}: ${error.message}`)
      count++
    }
  }
  console.log(`  ${count} market notes`)
}

async function seedCompanies() {
  for (const c of COMPANIES) {
    const row = {
      name: c.name,
      website: c.website,
      market: c.market,
      company_type: c.company_type,
      stage: c.stage,
      fit_score: c.fit_score,
      owner_id: ids.users[c.owner],
      product_id: ids.products[PRODUCT_BY_KEY[c.key] ?? 'Jute yarn'],
      next_touch_at:
        c.key === 'sahara' ? new Date().toISOString()
        : c.key === 'bosphorus' ? daysAgo(-1)
        : c.key === 'verde' ? daysAgo(-45)
        : null,
      disqualified_reason: c.key === 'nileco' ? 'Export licence unverifiable' : null,
    }
    const { data: existing } = await admin.from('company').select('id').eq('name', c.name).maybeSingle()
    if (existing) {
      ids.companies[c.key] = existing.id
      await admin.from('company').update(row).eq('id', existing.id)
    } else {
      const { data, error } = await admin.from('company').insert(row).select('id').single()
      if (error) throw new Error(`company ${c.name}: ${error.message}`)
      ids.companies[c.key] = data.id
    }
  }
  console.log(`  ${COMPANIES.length} companies`)

  for (const s of SOURCES) {
    await admin.from('source').insert({
      company_id: ids.companies[s.company],
      title: s.title,
      source_type: s.source_type,
      quality: s.quality,
      retrieved_at: daysAgo(6),
    })
  }

  // A verified fact needs evidence — the CHECK constraint enforces it — so grab a
  // source per company and attach it.
  for (const [key, facts] of Object.entries(FACTS)) {
    const { data: src } = await admin.from('source').select('id').eq('company_id', ids.companies[key]).limit(1).maybeSingle()
    for (const [k, v, prov, isCriterion] of facts) {
      await admin.from('fact').upsert(
        {
          company_id: ids.companies[key],
          key: k,
          value: v,
          provenance: prov,
          source_id: prov === 'verified' ? (src?.id ?? null) : null,
          confirmed_by: prov === 'human_approved' ? ids.users['nusrat.jahan@anwargroup.test'] : null,
          confirmed_at: prov === 'human_approved' ? daysAgo(14) : null,
          is_qualification_criterion: isCriterion,
        },
        { onConflict: 'company_id,key' },
      )
    }
  }

  for (const c of CONTACTS) {
    const { data } = await admin
      .from('contact')
      .insert({
        company_id: ids.companies[c.company],
        full_name: c.full_name,
        role_title: c.role_title,
        email: c.email,
        email_source: c.email_source,
        provenance: c.provenance,
        lawful_basis: c.lawful_basis,
        is_primary: c.is_primary,
      })
      .select('id')
      .single()
    if (data) ids.contacts[`${c.company}:${c.full_name}`] = data.id
  }
  console.log(`  ${SOURCES.length} sources, ${CONTACTS.length} contacts`)
}

async function seedConversations() {
  const rifat = ids.users['rifat.hasan@anwargroup.test']
  const sha256 = async (s: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // 1. The approved, sent first touch to Yıldız — the thread that produced a reply.
  const { data: sent } = await admin
    .from('message')
    .insert({
      company_id: ids.companies.yildiz,
      contact_id: ids.contacts['yildiz:Selin Aydın'],
      kind: 'first_touch',
      touch_number: 1,
      subject: 'Consistent 8 lb jute yarn from Chittagong',
      ai_body: YILDIZ_SENT,
      human_body: YILDIZ_SENT,
      why: ['Their production director named consistency publicly', 'Verified importer of this category', 'One question, about their own line'],
      status: 'sent',
      approved_by: rifat,
      approved_at: daysAgo(4),
      approved_hash: await sha256(YILDIZ_SENT),
    })
    .select('id')
    .single()

  // 2. Her reply — the split case. Triage fields left null so the demo can run the
  //    classification live, which is more convincing than showing a stored answer.
  await admin.from('reply').insert({
    company_id: ids.companies.yildiz,
    contact_id: ids.contacts['yildiz:Selin Aydın'],
    message_id: sent?.id,
    body: YILDIZ_REPLY,
    received_at: daysAgo(0.3),
    is_simulated: true,
  })

  // 3. The NordFiber draft waiting in the review queue. It deliberately contains a
  //    sample offer, so the guardrail fires the moment the reviewer opens it.
  await admin.from('message').insert({
    company_id: ids.companies.nordfiber,
    contact_id: ids.contacts['nordfiber:Lena Brauer'],
    kind: 'first_touch',
    touch_number: 1,
    subject: 'Consistent-count jute yarn for your PP replacement line',
    ai_body: DRAFT_BODY,
    why: [
      'Their product page names hessian liners — the message opens on their range, not ours',
      'Trade data confirms they already import jute, so this is a switch, not an education',
      'OEKO-TEX is on their supplier requirements page',
      'One question, not three',
    ],
    status: 'awaiting_approval',
    created_at: daysAgo(2.1),
  })

  await admin.from('task').insert([
    { company_id: ids.companies.kyoto, title: 'Confirm Kyoto Green importer licence', assignee_id: ids.users['nusrat.jahan@anwargroup.test'], due_on: new Date(Date.now() + 864e5).toISOString().slice(0, 10), blocks_stage: true },
    { company_id: null, title: 'Get EUDR file status from Compliance', assignee_id: rifat, due_on: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), blocks_stage: false },
    { company_id: ids.companies.yildiz, title: 'Prepare 8 lb sample request for commercial release', assignee_id: ids.users['mahbub.rahman@anwargroup.test'], blocks_stage: false },
  ])

  await admin.from('meeting').insert([
    { company_id: ids.companies.atlas, starts_at: new Date(Date.now() + 5 * 864e5).toISOString(), purpose: 'Introductory call, jute shopping bags', requires_commercial: false },
    { company_id: ids.companies.yildiz, starts_at: new Date(Date.now() + 9 * 864e5).toISOString(), purpose: 'Commercial discussion — terms', requires_commercial: true },
  ])

  await admin.from('suppression').upsert({
    email_or_domain: 'nileco.test',
    reason: 'Disqualified — export licence unverifiable',
  })

  await admin.from('audit_event').insert([
    { actor_id: rifat, actor_label: 'Rifat Hasan', event: 'Approved outreach', object_type: 'message', detail: 'Approved v3, 2 edits from AI draft', created_at: daysAgo(4) },
    { actor_label: 'System', event: 'Gmail draft created', object_type: 'message', detail: 'gmail.compose · recipient on .test allowlist', created_at: daysAgo(4) },
    { actor_label: 'AI (sonnet-class)', event: 'Research run', object_type: 'company', object_id: ids.companies.yildiz, detail: '14 pages read · 6 sources kept · 2 gaps raised', created_at: daysAgo(6) },
    { actor_id: ids.users['tanvir.alam@anwargroup.test'], actor_label: 'Tanvir Alam', event: 'Company disqualified', object_type: 'company', object_id: ids.companies.nileco, detail: 'Reason: export licence unverifiable · domain suppressed', created_at: daysAgo(1) },
    { actor_id: ids.users['tanvir.alam@anwargroup.test'], actor_label: 'Tanvir Alam', event: 'Access refused', detail: 'executive attempted: read Türkiye records', created_at: daysAgo(1) },
  ])

  console.log('  1 sent thread, 1 reply awaiting triage, 1 draft awaiting approval, 3 tasks, 2 meetings')
}

async function reset() {
  console.log('resetting app data (auth users kept)…')
  const noId = '00000000-0000-0000-0000-000000000000'
  for (const t of ['audit_event', 'reply', 'message', 'meeting', 'task', 'weekly_readout', 'market_note', 'fact', 'source', 'contact', 'ai_run', 'company'] as const) {
    await admin.from(t).delete().neq('id', noId)
  }
  await admin.from('suppression').delete().neq('email_or_domain', '')
}

async function main() {
  if (process.argv.includes('--reset')) await reset()

  console.log('seeding TradeReach AI…')
  await seedUsers()
  await seedCatalog()
  await seedMarketNotes()
  await seedCompanies()
  await seedConversations()

  console.log(`\ndone. sign in as any of:`)
  for (const u of TEAM) console.log(`  ${u.email}  /  ${PASSWORD}   (${u.role})`)
  console.log(`\nThe demo opens mid-journey: NordFiber has a draft waiting in the review`)
  console.log(`queue (it trips the sample guardrail), and Yıldız has an untriaged reply`)
  console.log(`asking for both a spec and a price — the split case.`)
}

main().catch((err) => {
  console.error('\nseed failed:', err)
  process.exit(1)
})
