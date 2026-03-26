'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, RefreshCw, User, Flag, Briefcase, Paperclip } from 'lucide-react'
import { toast } from '@/store/appStore'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'
import { QuickAddClientModal } from '@/components/clients/QuickAddClientModal'
import { InlineCustomFields } from '@/components/tasks/InlineCustomFields'

// ── Frequency options ─────────────────────────────────
const FREQUENCIES = [
  { group: 'Daily', v: 'daily', l: 'Every day' },
  { group: 'Weekly', v: 'weekly_mon', l: 'Every Monday' },
  { group: 'Weekly', v: 'weekly_tue', l: 'Every Tuesday' },
  { group: 'Weekly', v: 'weekly_wed', l: 'Every Wednesday' },
  { group: 'Weekly', v: 'weekly_thu', l: 'Every Thursday' },
  { group: 'Weekly', v: 'weekly_fri', l: 'Every Friday' },
  { group: 'Weekly', v: 'bi_weekly', l: 'Every 2 weeks' },
  { group: 'Monthly', v: 'monthly_1', l: '1st of every month' },
  { group: 'Monthly', v: 'monthly_15', l: '15th of every month' },
  { group: 'Monthly', v: 'monthly_last', l: 'Last day of month' },
  { group: 'Monthly', v: 'monthly', l: 'Monthly (same date)' },
  { group: 'Other', v: 'quarterly', l: 'Quarterly' },
  { group: 'Other', v: 'annual', l: 'Annually' },
]

export const FREQ_LABEL: Record<string, string> = Object.fromEntries(
  FREQUENCIES.map(f => [f.v, f.l])
)

const PRIORITY_OPTIONS = [
  { value: 'none', label: 'No priority', color: '#94a3b8' },
  { value: 'low', label: 'Low', color: '#16a34a' },
  { value: 'medium', label: 'Medium', color: '#ca8a04' },
  { value: 'high', label: 'High', color: '#ea580c' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' },
]

// ── Types ─────────────────────────────────
interface Props {
  members: { id: string; name: string }[]
  clients?: { id: string; name: string; color: string }[]
  currentUserId?: string
  editTask?: {
    id: string
    title: string
    frequency: string
    priority: string
    assignee_id: string | null
    client_id?: string | null
  }
  onCreated?: () => void
  onEdited?: () => void
  onCancelEdit?: () => void
}

// ── Component ─────────────────────────────────
export function InlineRecurringTask({
  members,
  clients = [],
  currentUserId,
  editTask,
  onCreated,
  onEdited,
  onCancelEdit,
}: Props) {
  const router = useRouter()

  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEdit = !!editTask
  const { customFields, taskFields } = useOrgSettings()

  const show = (key: string) => taskFields[key]?.visible !== false
  const required = (key: string) => taskFields[key]?.mandatory === true

  // ── State ─────────────────────────────────
  const [open, setOpen] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState(editTask?.title ?? '')
  const [frequency, setFrequency] = useState(editTask?.frequency ?? 'weekly_mon')
  const [priority, setPriority] = useState(editTask?.priority ?? 'medium')
  const [assignee, setAssignee] = useState(editTask?.assignee_id ?? currentUserId ?? '')
  const [clientId, setClientId] = useState(editTask?.client_id ?? '')
  const [files, setFiles] = useState<File[]>([])

  const [clientList, setClientList] = useState(clients)
  const [showAddClient, setShowAddClient] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customValues, setCustomValues] = useState<Record<string, any>>({})

  // ── Sync clients safely ─────────────────────
  useEffect(() => {
    setClientList(clients)
  }, [clients])

  // ── Autofocus ──────────────────────────────
  useEffect(() => {
    if (open && !isEdit) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, isEdit])

  // ── Outside click ──────────────────────────
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node) && !title.trim()) {
        close()
      }
    },
    [title]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  // ── Actions ────────────────────────────────
  function close() {
    if (isEdit) return onCancelEdit?.()

    setOpen(false)
    setTitle('')
    setFrequency('weekly_mon')
    setPriority('medium')
    setClientId('')
    setAssignee(currentUserId ?? '')
    setFiles([])
  }

  function validate() {
    const errs: Record<string, string> = {}

    if (!title.trim()) errs.title = 'Title required'
    if (required('assignee') && !assignee) errs.assignee = 'Assignee required'
    if (required('client') && !clientId) errs.client = 'Client required'
    if (required('attachment') && files.length === 0)
      errs.attachment = 'Attachment required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    if (!validate()) return

    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        frequency,
        priority,
        assignee_id: assignee || null,
        client_id: clientId || null,
        start_date: new Date().toISOString().split('T')[0],
        custom_fields: Object.keys(customValues).length ? customValues : undefined,
      }

      const res = await fetch(
        isEdit ? `/api/recurring/${editTask!.id}` : '/api/recurring',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      const data = await res.json()
      if (!res.ok) return toast.error(data.error ?? 'Failed')

      // upload files
      if (files.length && data.data?.id) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))

        await fetch(`/api/tasks/${data.data.id}/attachments`, {
          method: 'POST',
          body: fd,
        })
      }

      toast.success(isEdit ? 'Updated ✓' : 'Recurring task created ✓')

      if (isEdit) return onEdited?.()

      close()
      onCreated ? onCreated() : router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const priConf =
    PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  // ── Collapsed view ─────────────────────────
  if (!open) {
    return (
      <>
        {showAddClient && (
          <QuickAddClientModal
            onClose={() => setShowAddClient(false)}
            onCreated={c => {
              setClientList(p => [...p, c])
              setClientId(c.id)
              setShowAddClient(false)
            }}
          />
        )}

        <div
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            cursor: 'pointer',
            borderTop: '1px dashed var(--border)',
          }}
        >
          <Plus size={14} />
          <span style={{ fontSize: 13 }}>Add recurring task</span>
        </div>
      </>
    )
  }

  // ── Expanded view ─────────────────────────
  return (
    <>
      {showAddClient && (
        <QuickAddClientModal
          onClose={() => setShowAddClient(false)}
          onCreated={c => {
            setClientList(p => [...p, c])
            setClientId(c.id)
            setShowAddClient(false)
          }}
        />
      )}

      <div ref={rowRef} style={{ margin: '8px', border: '1px solid var(--border)', borderRadius: 10 }}>
        {/* Title */}
        <div style={{ display: 'flex', padding: 10 }}>
          <RefreshCw size={14} />
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') close()
            }}
            placeholder="Recurring task name…"
            style={{ flex: 1, border: 'none', outline: 'none', marginLeft: 8 }}
          />
          <button onClick={close}>
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, padding: 10, flexWrap: 'wrap' }}>
          {/* Frequency */}
          <select value={frequency} onChange={e => setFrequency(e.target.value)}>
            {FREQUENCIES.map(f => (
              <option key={f.v} value={f.v}>
                {f.l}
              </option>
            ))}
          </select>

          {/* Assignee */}
          <select value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Save */}
          <button onClick={save} disabled={!title.trim() || saving}>
            {saving ? 'Saving…' : 'Add task'}
          </button>
        </div>
      </div>
    </>
  )
}