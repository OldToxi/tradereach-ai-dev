'use server'

/**
 * lib/meeting-actions.ts — server actions for Meetings & tasks (T10.1-T10.3).
 *
 * Every action re-checks the role and lets RLS do the real enforcement, the same
 * boundary as lib/company-actions.ts and lib/reply-actions.ts. The meeting brief is
 * assembled deterministically (see lib/meetings.ts) — no model call, so this file does
 * not touch the AI client.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { admin } from './supabase/admin'
import { requirePermission, canWrite } from './session'
import { writeAudit, AUDIT } from './audit'
import { createCalendarEvent } from './gmail'
import { combineDateTime, buildMeetingBrief } from './meetings'

export type MeetingActionState = {
  ok: boolean
  error?: string
  meetingId?: string
  taskId?: string
  note?: string
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

async function guard(action: string) {
  try {
    return await requirePermission(canWrite, action)
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Not allowed' }
  }
}

/** The Commercial Authority's name, for the brief's "refer to" line. Service-role read:
 *  executives cannot read other profiles through RLS (see reply-actions.ts). */
async function commercialAuthorityName(): Promise<string> {
  const { data } = await admin
    .from('profiles')
    .select('full_name')
    .eq('role', 'commercial')
    .limit(1)
    .maybeSingle()
  return data?.full_name ?? 'the Commercial Authority'
}

/* ------------------------------------------------------------------ */
/* T10.1 — schedule a meeting (+ calendar event)                        */
/* ------------------------------------------------------------------ */

export async function scheduleMeeting(formData: FormData): Promise<MeetingActionState> {
  const actor = await guard('schedule meetings')
  if (!('id' in actor)) return actor

  const companyId = (formData.get('companyId') as string)?.trim()
  const date = (formData.get('date') as string)?.trim()
  const time = (formData.get('time') as string)?.trim()
  const purpose = (formData.get('purpose') as string)?.trim()
  const prepareBrief = formData.get('prepareBrief') === 'on'

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Choose a company.' }
  if (!date || !time) return { ok: false, error: 'Choose a date and time.' }
  if (!purpose) return { ok: false, error: 'Choose a purpose.' }

  const supabase = await createServerClient()
  const [{ data: company }, { data: contact }] = await Promise.all([
    supabase.from('company').select('name, market, company_type').eq('id', companyId).single(),
    supabase
      .from('contact')
      .select('full_name, role_title, email')
      .eq('company_id', companyId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle(),
  ])
  if (!company) return { ok: false, error: 'Company not found.' }

  const requiresCommercial = purpose.toLowerCase().includes('commercial')
  const startsAt = combineDateTime(date, time)

  let brief: string | null = null
  if (prepareBrief) {
    const [{ data: run }, { data: facts }] = await Promise.all([
      supabase
        .from('research_run')
        .select('summary, gaps')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('fact')
        .select('key')
        .eq('company_id', companyId)
        .eq('provenance', 'verified'),
    ])

    const gaps = Array.isArray(run?.gaps) ? (run.gaps as Array<{ field?: string }>) : []
    const built = buildMeetingBrief({
      companyName: company.name,
      market: company.market,
      companyType: company.company_type,
      summary: run?.summary ?? null,
      openQuestions: gaps.map((g) => g.field ?? '').filter(Boolean),
      authorityName: await commercialAuthorityName(),
      verifiedFactCount: facts?.length ?? 0,
    })
    brief = built.text
  }

  const { data: meeting, error } = await supabase
    .from('meeting')
    .insert({
      company_id: companyId,
      starts_at: startsAt,
      purpose,
      requires_commercial: requiresCommercial,
      brief,
    })
    .select('id')
    .single()
  if (error || !meeting) return { ok: false, error: error?.message ?? 'Could not schedule the meeting.' }

  // Calendar invite is best-effort: the meeting row is what the pipeline relies on. A
  // missing/expired calendar token must not roll back the schedule.
  let calendarNote = ''
  try {
    const { eventId } = await createCalendarEvent({
      profileId: actor.id,
      summary: `${purpose} — ${company.name}`,
      start: startsAt,
      end: new Date(new Date(startsAt).getTime() + 30 * 60000).toISOString(),
      attendeeEmail: contact?.email ?? null,
      attendeeName: contact?.full_name ?? null,
    })
    await supabase.from('meeting').update({ calendar_event_id: eventId }).eq('id', meeting.id)
    calendarNote = ' Calendar invite created.'
  } catch (err) {
    calendarNote = ` ${err instanceof Error ? err.message : 'Calendar invite could not be created.'}`
  }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.MEETING_SCHEDULED,
    objectType: 'meeting',
    objectId: meeting.id,
    detail: `${purpose} — ${company.name}${brief ? ' · brief prepared' : ''}`,
  })

  revalidatePath('/meetings')
  revalidatePath('/dashboard')
  return { ok: true, meetingId: meeting.id, note: `Meeting scheduled.${calendarNote}` }
}

/* ------------------------------------------------------------------ */
/* T10.3 — create a task                                               */
/* ------------------------------------------------------------------ */

export async function addTask(formData: FormData): Promise<MeetingActionState> {
  const actor = await guard('create tasks')
  if (!('id' in actor)) return actor

  const title = (formData.get('title') as string)?.trim()
  const assigneeId = (formData.get('assigneeId') as string)?.trim() || null
  const dueOn = (formData.get('dueOn') as string)?.trim() || null
  const companyId = (formData.get('companyId') as string)?.trim() || null
  const blocksStage = formData.get('blocksStage') === 'on'

  if (!title) return { ok: false, error: 'Say what needs doing.' }
  if (companyId && !isUuid(companyId)) return { ok: false, error: 'Unknown company.' }

  const supabase = await createServerClient()
  const { data: task, error } = await supabase
    .from('task')
    .insert({
      title,
      assignee_id: assigneeId || actor.id,
      due_on: dueOn,
      company_id: companyId,
      blocks_stage: blocksStage,
    })
    .select('id')
    .single()
  if (error || !task) return { ok: false, error: error?.message ?? 'Could not create the task.' }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.TASK_CREATED,
    objectType: 'task',
    objectId: task.id,
    detail: `${title}${blocksStage ? ' · blocks stage advancement' : ''}`,
  })

  revalidatePath('/meetings')
  return { ok: true, taskId: task.id, note: blocksStage ? 'Task created — it blocks stage advancement until done.' : 'Task created.' }
}

/* ------------------------------------------------------------------ */
/* T10.3 — tick a task done / undo                                     */
/* ------------------------------------------------------------------ */

export async function toggleTaskDone(formData: FormData): Promise<MeetingActionState> {
  const actor = await guard('update tasks')
  if (!('id' in actor)) return actor

  const taskId = (formData.get('taskId') as string)?.trim()
  const done = formData.get('done') === 'on'
  if (!taskId || !isUuid(taskId)) return { ok: false, error: 'Missing task.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('task').update({ done }).eq('id', taskId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/meetings')
  return { ok: true, taskId, note: done ? 'Task completed.' : 'Task reopened.' }
}
