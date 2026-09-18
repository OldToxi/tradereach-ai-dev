import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canWrite } from '@/lib/session'
import { MeetingsScreen, type MeetingRow, type TaskRow } from '@/components/MeetingsScreen'

interface MeetingQuery {
  id: string
  starts_at: string
  purpose: string
  brief: string | null
  requires_commercial: boolean
  company_id: string
  company: { name: string } | null
}

interface TaskQuery {
  id: string
  title: string
  done: boolean
  due_on: string | null
  blocks_stage: boolean
  company_id: string | null
  company: { name: string } | null
  assignee: { full_name: string } | null
}

export default async function MeetingsPage() {
  const supabase = await createServerClient()
  const user = await currentUser()

  const [
    { data: meetings, error },
    { data: tasks },
    { data: primaryContacts },
    { data: companies },
    { data: assignees },
  ] = await Promise.all([
    supabase
      .from('meeting')
      .select('id, starts_at, purpose, brief, requires_commercial, company_id, company(name)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .returns<MeetingQuery[]>(),
    supabase
      .from('task')
      .select('id, title, done, due_on, blocks_stage, company_id, company(name), assignee:profiles(full_name)')
      .order('created_at')
      .returns<TaskQuery[]>(),
    supabase.from('contact').select('company_id, full_name, role_title').eq('is_primary', true),
    supabase.from('company').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['executive', 'manager', 'commercial'])
      .order('full_name'),
  ])

  if (error) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Meetings &amp; tasks</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>Could not load meetings: {error.message}</p>
        </div>
      </div>
    )
  }

  const contacts = new Map<string, { full_name: string; role_title: string | null }>()
  for (const c of primaryContacts ?? []) {
    contacts.set(c.company_id, { full_name: c.full_name, role_title: c.role_title })
  }

  const meetingRows: MeetingRow[] = (meetings ?? []).map((m) => {
    const contact = contacts.get(m.company_id)
    return {
      id: m.id,
      starts_at: m.starts_at,
      purpose: m.purpose,
      brief: m.brief,
      requires_commercial: m.requires_commercial,
      companyId: m.company_id,
      companyName: m.company?.name ?? 'Unknown company',
      contactName: contact?.full_name ?? null,
      contactTitle: contact?.role_title ?? null,
    }
  })

  const taskRows: TaskRow[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    due_on: t.due_on,
    blocks_stage: t.blocks_stage,
    companyName: t.company?.name ?? null,
    assigneeName: t.assignee?.full_name ?? null,
  }))

  return (
    <MeetingsScreen
      meetings={meetingRows}
      tasks={taskRows}
      companies={(companies ?? []).map((c) => ({ id: c.id, name: c.name }))}
      assignees={(assignees ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
      canWrite={canWrite(user)}
    />
  )
}
