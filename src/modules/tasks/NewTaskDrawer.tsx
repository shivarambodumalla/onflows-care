import { useEffect, useState } from 'react'
import { Button, Drawer, Field, Input, Select, Textarea, useToast } from '@/design-system'
import { createTask } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { staffIn } from '@/data/selectors'
import { addDays, todayISO } from '@/lib/dates'
import type { TaskPriority } from '@/data/types'

export function NewTaskDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, branch, user, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState(user.id)
  const [patientId, setPatientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setAssigneeId(user.id)
    setPatientId('')
    setDueDate(todayISO())
    setPriority('normal')
    setError('')
  }, [open, user.id])

  const submit = () => {
    if (!title.trim()) return setError('Give the task a title')

    apply((db) =>
      createTask(db, ctx, {
        title: title.trim(),
        description: description.trim() || undefined,
        branchId: branch.id,
        assigneeId: assigneeId || undefined,
        patientId: patientId || undefined,
        dueAt: new Date(`${dueDate}T17:00:00`).toISOString(),
        priority,
      }),
    )
    onClose()
    toast.success('Task created')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New task"
      description={branch.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Create task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <Field label="Title" required>
          {({ id }) => (
            <Input
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call to confirm tomorrow’s schedule"
            />
          )}
        </Field>

        <Field label="Details">
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="optional"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to">
            {({ id }) => (
              <Select id={id} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {staffIn(db, branch.id).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.id === user.id ? ' (you)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Priority">
            {({ id }) => (
              <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            )}
          </Field>

          <Field label="Due date" required>
            {({ id }) => (
              <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            )}
          </Field>

          <Field label="Related patient" hint="optional">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">None</option>
                {db.patients
                  .filter((p) => p.status === 'active' && p.branchId === branch.id)
                  .slice(0, 60)
                  .map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} — {patient.code}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="flex gap-1.5">
          {[
            { label: 'Today', days: 0 },
            { label: 'Tomorrow', days: 1 },
            { label: 'In 3 days', days: 3 },
            { label: 'Next week', days: 7 },
          ].map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="secondary"
              onClick={() => setDueDate(addDays(new Date(), preset.days).toISOString().slice(0, 10))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </Drawer>
  )
}
