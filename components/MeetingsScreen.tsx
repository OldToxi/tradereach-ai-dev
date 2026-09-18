'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTaskDone } from '@/lib/meeting-actions'
import { formatWhen, meetingPrep, dueLabel } from '@/lib/meetings'
import { MeetingModal, type MeetingCompanyOption } from './MeetingModal'
import { TaskModal, type AssigneeOption } from './TaskModal'

export interface MeetingRow {
  id: string
  starts_at: string
  purpose: string
  brief: string | null
  requires_commercial: boolean
  companyId: string
  companyName: string
  contactName: string | null
  contactTitle: string | null
}

export interface TaskRow {
  id: string
  title: string
  done: boolean
  due_on: string | null
  blocks_stage: boolean
  companyName: string | null
  assigneeName: string | null
}

export function MeetingsScreen({
  meetings,
  tasks,
  companies,
  assignees,
  canWrite,
}: {
  meetings: MeetingRow[]
  tasks: TaskRow[]
  companies: MeetingCompanyOption[]
  assignees: AssigneeOption[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [showMeeting, setShowMeeting] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [pendingTask, setPendingTask] = useState<string | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    meetings.find((m) => m.brief)?.id ?? meetings[0]?.id ?? null,
  )

  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks])
  const doneTasks = useMemo(() => tasks.filter((t) => t.done), [tasks])
  const selected = meetings.find((m) => m.id === selectedMeetingId) ?? null

  async function onToggle(task: TaskRow) {
    setPendingTask(task.id)
    setNote(null)
    const fd = new FormData()
    fd.set('taskId', task.id)
    fd.set('done', task.done ? '' : 'on')
    const res = await toggleTaskDone(fd)
    setPendingTask(null)
    if (res.ok) setNote(res.note ?? null)
    router.refresh()
  }

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Meetings &amp; tasks</h1>
          <p>Where conversations turn into commitments — and the short brief that goes into the room with you.</p>
        </div>
        {canWrite ? (
          <button className="btn btn-pri" onClick={() => setShowMeeting(true)}>
            Schedule meeting
          </button>
        ) : null}
      </div>

      {note ? (
        <p className="small" style={{ color: 'var(--verified)', margin: '0 0 12px' }}>
          {note}
        </p>
      ) : null}

      <div className="split">
        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <header>
              <h3>Upcoming</h3>
            </header>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Company</th>
                    <th>With</th>
                    <th>Purpose</th>
                    <th>Prep</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted" style={{ padding: 18 }}>
                        No meetings scheduled. Schedule one to bring a brief into the room.
                      </td>
                    </tr>
                  ) : (
                    meetings.map((m) => {
                      const when = formatWhen(m.starts_at)
                      const prep = meetingPrep(m)
                      const withText = m.contactName
                        ? `${m.contactName}${m.contactTitle ? `, ${m.contactTitle}` : ''}`
                        : '—'
                      return (
                        <tr key={m.id} className={m.id === selectedMeetingId ? 'tr-sel' : undefined}>
                          <td>
                            <b>
                              {when.day} {when.time}
                            </b>
                            <div className="tiny muted">GMT+6 · Google Meet</div>
                          </td>
                          <td>{m.companyName}</td>
                          <td>{withText}</td>
                          <td>{m.purpose}</td>
                          <td>
                            <span className={`tag ${prep.className}`}>{prep.label}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm"
                              onClick={() => setSelectedMeetingId(m.id)}
                            >
                              Open brief
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Open tasks</h3>
              <div className="grow" />
              {canWrite ? (
                <button className="btn btn-sm" onClick={() => setShowTask(true)}>
                  Add task
                </button>
              ) : null}
            </header>
            <div className="body grid" style={{ gap: 9 }}>
              {openTasks.length === 0 && doneTasks.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No tasks yet.
                </p>
              ) : null}
              {openTasks.map((t) => (
                <label key={t.id} className="small" style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={!canWrite || pendingTask === t.id}
                    onChange={() => onToggle(t)}
                  />
                  <span>
                    <b>{t.title}</b>
                    <div className="muted">
                      {[
                        t.blocks_stage ? 'Blocks stage advancement' : null,
                        dueLabel(t.due_on),
                        t.companyName,
                        t.assigneeName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </span>
                </label>
              ))}
              {doneTasks.map((t) => (
                <label
                  key={t.id}
                  className="small"
                  style={{ display: 'flex', gap: 9, alignItems: 'flex-start', opacity: 0.55 }}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={!canWrite || pendingTask === t.id}
                    onChange={() => onToggle(t)}
                  />
                  <span>
                    <b>{t.title}</b>
                    <div className="muted">{t.assigneeName ? `Done · ${t.assigneeName}` : 'Done'}</div>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="aiblock">
          <div className="h">
            <span className="prov prov-a">
              <i></i>AI analysis
            </span>{' '}
            Meeting brief — {selected ? selected.companyName : 'no meeting'}
          </div>
          {selected?.brief ? (
            <>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selected.brief}</p>
              <div className="foot">
                <span>
                  Assembled from verified facts and the email thread · nothing here is a commitment
                </span>
              </div>
            </>
          ) : (
            <p>
              No brief prepared for this meeting. Reschedule it with &ldquo;prepare a brief&rdquo;
              ticked, or finish the company&apos;s research first so the brief has verified facts to
              work from.
            </p>
          )}
        </div>
      </div>

      {showMeeting ? (
        <MeetingModal
          companies={companies}
          onClose={() => setShowMeeting(false)}
          onSaved={(n) => {
            setNote(n)
            router.refresh()
          }}
        />
      ) : null}
      {showTask ? (
        <TaskModal
          assignees={assignees}
          companies={companies}
          onClose={() => setShowTask(false)}
          onSaved={(n) => {
            setNote(n)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
