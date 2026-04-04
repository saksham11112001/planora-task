'use client'
// Custom fields panel
import { CustomFieldsPanel } from '@/components/tasks/CustomFieldsPanel'
import type { CustomFieldDef } from '@/components/tasks/CustomFieldsPanel'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ThumbsUp, ThumbsDown, Flag, Calendar, User, Briefcase, Send, Clock, Sparkles, ShieldCheck, RefreshCw, FolderPlus, ArrowRightLeft } from 'lucide-react'
import { cn }             from '@/lib/utils/cn'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import type { Task }      from '@/types'
import { toast }          from '@/store/appStore'
import { MentionTextarea, CommentText } from '@/components/tasks/MentionTextarea'
import { isOverdue }      from '@/lib/utils/format'
import { Avatar }         from '@/components/ui/Badge'

interface Props {
  task:           Task | null
  members:        { id: string; name: string }[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  onClose:        () => void
  onUpdated?:     () => void
}

export function TaskDetailPanel({ task, members, clients, currentUserId, userRole, onClose, onUpdated }: Props) {
  const router     = useRouter()
  const isOpen     = !!task
  const canManage  = ['owner', 'admin', 'manager'].includes(userRole ?? '')
  // Designated approver: if task has approver_id, only that person can approve/reject
  // If no approver set, any manager can
  const isDesignatedApprover = task?.approver_id
    ? task.approver_id === currentUserId
    : canManage
  const approverInfo = (task as any)?.approver as unknown as { id: string; name: string } | null
  const isAssignee = task?.assignee_id === currentUserId

  /* local editable state */
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [status,      setStatus]      = useState('todo')
  const [priority,    setPriority]    = useState('medium')
  const [assigneeId,  setAssigneeId]  = useState('')
  const [clientId,    setClientId]    = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [estHours,    setEstHours]    = useState('')
  const [completing,  setCompleting]  = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [comment,     setComment]     = useState('')
  const [sending,     setSending]     = useState(false)
  const [tab,         setTab]         = useState<'details' | 'subtasks' | 'attachments' | 'comments' | 'time'>('details')
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([])

  const [subtasks,      setSubtasks]      = useState<any[]>([])
  const [subtasksLoaded,setSubtasksLoaded]= useState(false)
  const [newSubtitle,   setNewSubtitle]   = useState('')
  const [addingSub,     setAddingSub]     = useState(false)
  const [attachments,   setAttachments]   = useState<any[]>([])
  const [attLoaded,     setAttLoaded]     = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [isSaving,  setIsSaving]  = useState(false)
  const [converting, setConverting] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (tab === 'subtasks' && task) loadSubtasks(task.id)
    if (tab === 'attachments' && task) loadAttachments(task.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, task?.id])

  /* load org custom field definitions once on mount */
  useEffect(() => {
    fetch('/api/settings/custom-fields')
      .then(r => r.json())
      .then(d => setCustomFieldDefs(d.data ?? []))
      .catch(() => {})
  }, [])

  /* sync from task */
  useEffect(() => {
    if (!task) return
    setSubtasksLoaded(false); setAttLoaded(false)
    setSubtasks([]); setAttachments([])
    setTitle(task.title)
    setDescription(task.description ?? '')
    setStatus(task.status)
    setPriority(task.priority)
    setAssigneeId(task.assignee_id ?? '')
    setClientId(task.client_id ?? '')
    setDueDate(task.due_date ?? '')
    setEstHours(task.estimated_hours?.toString() ?? '')
    setTab('details')
  }, [task?.id])

  /* auto-grow textarea */
  useEffect(() => {
    if (!titleRef.current) return
    titleRef.current.style.height = 'auto'
    titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
  }, [title])

  /* Clear pending save timers when panel closes */
  useEffect(() => {
    if (!task && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [task])

  /* Escape to close */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* generic PATCH helper — fires and forgets UI state; rolls back on fail */
  const patch = useCallback(async (fields: Record<string, unknown>, rollback?: () => void) => {
    if (!task) return
    setIsSaving(true)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    setIsSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Could not save — change reverted')
      rollback?.()   // restore previous field value
      return
    }
    onUpdated?.()
    router.refresh()
  }, [task, onUpdated, router])

  /* debounced patch — for text fields that change frequently */
  const patchDebounced = useCallback((fields: Record<string, unknown>, delay = 600) => {
    if (!task) return  // guard: don't save if panel is closing
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => patch(fields), delay)
  }, [patch, task])


  /* convert one-time task to recurring */
  async function convertToRecurring() {
    if (!task || converting) return
    const freq = prompt('Frequency? (daily / weekly / monthly / quarterly / annual)', 'weekly')
    if (!freq) return
    const allowed = ['daily','weekly','bi_weekly','monthly','quarterly','annual']
    if (!allowed.includes(freq.trim().toLowerCase())) {
      toast.error('Invalid frequency. Use: daily, weekly, monthly, quarterly, annual')
      return
    }
    setConverting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_recurring: true,
          frequency: freq.trim().toLowerCase(),
          next_occurrence_date: task.due_date ?? new Date().toISOString().split('T')[0],
        }),
      })
      if (res.ok) {
        toast.success('Task converted to recurring ✓')
        onUpdated?.()
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Conversion failed')
      }
    } finally { setConverting(false) }
  }

  /* add one-time task to a project */
  async function addToProject() {
    if (!task || converting) return
    const projectName = prompt('Enter the project name to add this task to:')
    if (!projectName?.trim()) return
    setConverting(true)
    try {
      // Look up project by name
      const res = await fetch(`/api/projects?search=${encodeURIComponent(projectName.trim())}`)
      const d = await res.json()
      const projects: any[] = d.data ?? []
      const match = projects.find((p: any) => p.name.toLowerCase() === projectName.trim().toLowerCase())
      if (!match) {
        toast.error(`Project "${projectName}" not found. Check the name and try again.`)
        setConverting(false)
        return
      }
      const patchRes = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: match.id }),
      })
      if (patchRes.ok) {
        toast.success(`Added to "${match.name}" ✓`)
        onUpdated?.()
        onClose()
      } else {
        const err = await patchRes.json().catch(() => ({}))
        toast.error(err.error ?? 'Failed to move task')
      }
    } finally { setConverting(false) }
  }

  /* complete toggle */
  async function handleComplete() {
    if (!task) return
    setCompleting(true)
    const newStatus  = status === 'completed' ? 'todo' : 'completed'
    const prevStatus = status
    setStatus(newStatus)   // optimistic
    await patch(
      { status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null },
      () => setStatus(prevStatus),   // rollback on API error
    )
    if (newStatus === 'completed') toast.success('Task completed! 🎉')
    setCompleting(false)
  }

  /* ── FIXED: approve / reject go through /approve endpoint ── */
  async function callApproveAPI(decision: 'approve' | 'reject' | 'submit') {
    if (!task) return
    setApproving(true)
    const res = await fetch(`/api/tasks/${task.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    const d = await res.json()
    setApproving(false)
    if (!res.ok) { toast.error(d.error ?? 'Action failed'); return }
    if (decision === 'approve') toast.success('Task approved! ✅')
    if (decision === 'reject')  toast.info('Task rejected — sent back to assignee')
    if (decision === 'submit')  toast.info('Submitted for approval')
    onUpdated?.()
    router.refresh()
  }

  /* comment */
  async function loadSubtasks(taskId: string) {
    if (subtasksLoaded) return
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json()
    setSubtasks(d.data ?? [])
    setSubtasksLoaded(true)
  }

  async function addSubtask() {
    if (!newSubtitle.trim() || !task) return
    setAddingSub(true)
    const r = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtitle.trim(), parent_task_id: task.id,
        project_id: task.project_id ?? null, assignee_id: task.assignee_id ?? null }),
    })
    const d = await r.json()
    if (r.ok) { setSubtasks(p => [d.data, ...p]); setNewSubtitle('') }
    setAddingSub(false)
  }

  async function toggleSubtask(sub: any) {
    const ns = sub.status === 'completed' ? 'todo' : 'completed'

    // CA compliance subtasks REQUIRE an attachment before completing
    if (ns === 'completed' && sub.custom_fields?._compliance_subtask) {
      const attRes = await fetch(`/api/tasks/${sub.id}/attachments`)
      const attData = await attRes.json().catch(() => ({ data: [] }))
      if ((attData.data ?? []).length === 0) {
        toast.error('📎 Upload the required document before completing this subtask')
        return
      }
    }

    // Optimistic update first
    setSubtasks(p => p.map(s => s.id === sub.id ? { ...s, status: ns } : s))
    const res = await fetch(`/api/tasks/${sub.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ns, completed_at: ns === 'completed' ? new Date().toISOString() : null }) })
    if (!res.ok) {
      // Revert on failure
      setSubtasks(p => p.map(s => s.id === sub.id ? { ...s, status: sub.status } : s))
      toast.error('Could not update subtask')
    }
  }

  async function loadAttachments(taskId: string) {
    if (attLoaded) return
    const r = await fetch(`/api/tasks/${taskId}/attachments`)
    const d = await r.json()
    setAttachments(d.data ?? [])
    setAttLoaded(true)
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!task || !e.target.files?.[0]) return
    setUploading(true)
    const form = new FormData()
    form.append('file', e.target.files[0])
    const r = await fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', body: form })
    const d = await r.json()
    if (r.ok) { setAttachments(p => [d.data, ...p]); toast.success('File uploaded') }
    else toast.error(d.error ?? 'Upload failed')
    setUploading(false)
    e.target.value = ''
  }

  async function deleteAttachment(attId: string, storagePath: string) {
    if (!task || !confirm('Delete this attachment?')) return
    await fetch(`/api/tasks/${task.id}/attachments?attachment_id=${attId}`, { method: 'DELETE' })
    setAttachments(p => p.filter(a => a.id !== attId))
    toast.success('Deleted')
  }

  async function getSignedUrl(storagePath: string, fileName: string) {
    // Use Supabase client to get signed URL for download
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data } = await sb.storage.from('attachments').createSignedUrl(storagePath, 60)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl; a.download = fileName; a.click()
    }
  }

  async function sendComment() {
    if (!comment.trim() || !task) return
    setSending(true)
    await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment.trim() }),
    })
    setComment('')
    setSending(false)
    onUpdated?.()
    router.refresh()
  }

  const isCompleted = status === 'completed'
  const isPending   = task?.approval_status === 'pending'
  const overdue     = isOverdue(task?.due_date, status)
  const priConf     = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium
  const assignee    = members.find(m => m.id === assigneeId)
  const client      = clients.find(c => c.id === clientId)
  const myName      = members.find(m => m.id === currentUserId)?.name ?? 'U'

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50" onClick={onClose} style={{ zIndex: 199, backdropFilter: "blur(2px)" }} />
      )}

      <div className={cn('detail-panel', isOpen && 'open')} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {task && (
          <>
            {/* ── Panel header ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b sticky top-0 z-10"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <button
                onClick={handleComplete}
                className={cn('task-check flex-shrink-0', isCompleted && 'done', completing && 'popping')}
                title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
              >
                {isCompleted && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                    <path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className="text-xs font-medium flex-1" style={{ color: isCompleted ? '#16a34a' : 'var(--text-muted)' }}>
                {isCompleted ? '✓ Completed' : 'Mark complete'}
              </span>
              {isSaving && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Saving…</span>
              )}
              <button onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors"
                title="Close (Esc)"
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Approval banners ── */}
            {isPending && isDesignatedApprover && (
              <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ background: 'var(--warning-surface, #fffbeb)', borderColor: 'var(--warning-border, #fde68a)' }}>
                <p className="text-xs font-semibold text-amber-800 flex-1">Pending your approval</p>
                <button onClick={() => callApproveAPI('approve')} disabled={approving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                  <ThumbsUp className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => callApproveAPI('reject')} disabled={approving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                  <ThumbsDown className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            )}

            {/* Designated approver info */}
            {task.approval_required && approverInfo && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500 flex-shrink-0"/>
                <span className="text-violet-700">
                  Approver: <strong>{approverInfo.name}</strong>
                </span>
              </div>
            )}
            {task.approval_required && !approverInfo && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500 flex-shrink-0"/>
                <span className="text-violet-700">Any manager can approve this task</span>
              </div>
            )}
            {task.approval_status === 'rejected' && (
              <div className="px-4 py-2.5 border-b" style={{ background: 'rgba(220,38,38,0.1)', borderColor:'rgba(220,38,38,0.25)' }}>
                <p className="text-xs font-semibold text-red-700">❌ Rejected — please revise and resubmit</p>
              </div>
            )}

            {task.approval_status === 'approved' && (
              <div className="px-4 py-2.5 border-b" style={{ background: 'rgba(22,163,74,0.1)', borderColor:'rgba(22,163,74,0.25)' }}>
                <p className="text-xs font-semibold text-green-700">✅ Approved</p>
              </div>
            )}

            {task.approval_required && !task.approval_status && isAssignee && status !== 'completed' && (
              <div className="px-4 py-2.5 border-b" style={{ background: 'rgba(59,130,246,0.1)', borderColor:'rgba(59,130,246,0.25)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-700">This task requires approval before it can be completed</p>
                  <button onClick={() => callApproveAPI('submit')} disabled={approving}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline ml-3">
                    Submit for review →
                  </button>
                </div>
              </div>
            )}

            {/* ── Editable title + description ── */}
            <div className="px-5 py-4">
              <textarea
                ref={titleRef}
                value={title}
                onChange={e => { setTitle(e.target.value); patchDebounced({ title: e.target.value }) }}
                onBlur={() => { if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; if (task && title !== task.title) patch({ title }) } }}
                rows={1}
                className={cn(
                  'w-full text-lg font-bold resize-none outline-none bg-transparent leading-snug',
                  isCompleted ? 'line-through' : ''
                )}
                style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
              />
              <textarea
                value={description}
                onChange={e => { setDescription(e.target.value); patchDebounced({ description: e.target.value || null }, 800) }}
                onBlur={() => { if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; if (task && description !== (task.description ?? '')) patch({ description: description || null }) } }}
                placeholder="Add a description..."
                rows={3}
                className="w-full mt-2 text-sm resize-none outline-none bg-transparent leading-relaxed"
                style={{ color: 'var(--text-secondary)', caretColor: 'var(--brand)' }}
              />
            </div>

            {/* ── Tabs ── */}
            <div className="tab-bar px-5">
              {(['details', 'subtasks', 'attachments', 'comments', 'time'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={cn('tab-item capitalize', tab === t && 'active')}>
                  {t === 'subtasks' ? 'Subtasks' : t === 'attachments' ? '📎 Files' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Details ── */}
            {tab === 'details' && (
              <>
              <div className="px-5 py-3">
                <FieldRow label="Status">
                  <select value={status} onChange={e => { const prev = status; setStatus(e.target.value); patch({ status: e.target.value }, () => setStatus(prev)) }}
                    className="text-sm bg-transparent outline-none cursor-pointer flex-1"
                    style={{ color: 'var(--text-primary)' }}>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Priority">
                  <Flag className="h-3.5 w-3.5" style={{ color: priConf.color }} />
                  <select value={priority} onChange={e => { const prev = priority; setPriority(e.target.value); patch({ priority: e.target.value }, () => setPriority(prev)) }}
                    className="text-sm bg-transparent outline-none cursor-pointer flex-1"
                    style={{ color: 'var(--text-primary)' }}>
                    {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Assignee">
                  {assigneeId && <Avatar name={assignee?.name ?? '?'} size="xs" />}
                  <select value={assigneeId} onChange={e => { const prev = assigneeId; setAssigneeId(e.target.value); patch({ assignee_id: e.target.value || null }, () => setAssigneeId(prev)) }}
                    className="text-sm bg-transparent outline-none cursor-pointer flex-1"
                    style={{ color: 'var(--text-primary)' }}>
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
                    ))}
                  </select>
                </FieldRow>

                {/* Co-assignees from custom_fields */}
                {(() => {
                  const coIds: string[] = (task as any)?.custom_fields?._co_assignees ?? []
                  if (!coIds.length) return null
                  const coNames = coIds.map((id: string) => members.find(m => m.id === id)?.name).filter(Boolean)
                  if (!coNames.length) return null
                  return (
                    <FieldRow label="Co-assignees">
                      <User className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      <div className="flex gap-1 flex-wrap">
                        {coNames.map((name, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            {name as string}
                          </span>
                        ))}
                      </div>
                    </FieldRow>
                  )
                })()}

                <FieldRow label="Due date">
                  <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                  <input type="date" value={dueDate}
                    onChange={e => { const prev = dueDate; setDueDate(e.target.value); patch({ due_date: e.target.value || null }, () => setDueDate(prev)) }}
                    className="text-sm outline-none cursor-pointer flex-1 rounded-md px-2 py-1"
                    style={{
                      color: overdue ? '#dc2626' : dueDate ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border)',
                      colorScheme: 'light dark',
                    }}
                  />
                  {overdue && <span className="text-xs text-red-500 font-medium flex-shrink-0">Overdue</span>}
                </FieldRow>

                {clients.length > 0 && (
                  <FieldRow label="Client">
                    {clientId && <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: client?.color }} />}
                    <select value={clientId} onChange={e => { setClientId(e.target.value); patch({ client_id: e.target.value || null }) }}
                      className="text-sm bg-transparent outline-none cursor-pointer flex-1"
                      style={{ color: 'var(--text-primary)' }}>
                      <option value="">No client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FieldRow>
                )}

                <FieldRow label="Est. hours">
                  <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                  <input type="number" step="0.5" min="0" value={estHours}
                    onChange={e => setEstHours(e.target.value)}
                    onBlur={() => patch({ estimated_hours: estHours ? parseFloat(estHours) : null })}
                    placeholder="0"
                    className="text-sm bg-transparent outline-none w-16"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  {estHours && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>hrs</span>}
                </FieldRow>

                {task.project && (
                  <FieldRow label="Project">
                    <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: (task.project as any).color }} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{(task.project as any).name}</span>
                  </FieldRow>
                )}
              </div>

              {/* ── Convert task actions ── */}
              {!task.is_recurring && (
                <div className="px-5 pb-4 pt-2">
                  <button
                    onClick={() => setShowConvert(p => !p)}
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <ArrowRightLeft className="h-3 w-3"/>
                    Convert this task
                    <span style={{ fontSize: 10, marginLeft: 2 }}>{showConvert ? '▲' : '▼'}</span>
                  </button>
                  {showConvert && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button
                        onClick={convertToRecurring}
                        disabled={converting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'rgba(13,148,136,0.12)', color: 'var(--brand)', border: '1px solid rgba(13,148,136,0.3)', cursor: 'pointer', opacity: converting ? 0.6 : 1 }}>
                        <RefreshCw className="h-3 w-3"/>
                        Make recurring
                      </button>
                      {!task.project_id && (
                        <button
                          onClick={addToProject}
                          disabled={converting}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)', cursor: 'pointer', opacity: converting ? 0.6 : 1 }}>
                          <FolderPlus className="h-3 w-3"/>
                          Add to project
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* ── Custom fields ── */}
              {customFieldDefs.length > 0 && task && (
                <div className="px-5 pb-3">
                  <CustomFieldsPanel
                    taskId={task.id}
                    fieldDefs={customFieldDefs}
                    existing={(task as any).custom_fields ?? {}}
                    onSaved={fields => {}}
                  />
                </div>
              )}
              </>
            )}

            {/* ── Subtasks ── */}
            {tab === 'subtasks' && (
              <div style={{ padding: '8px 0' }}>
                {/* Subtask list + inline add below each */}
                {subtasks.length === 0 && (
                  <div style={{ padding: '20px 20px 4px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No subtasks yet</p>
                  </div>
                )}
                <div>
                  {subtasks.map(sub => (
                    <div key={sub.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 20px', borderBottom: '1px solid var(--border-light)',
                        background: 'var(--surface)' }}
                      className="group">
                      <button onClick={() => toggleSubtask(sub)}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'}`,
                          background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', padding: 0, transition: 'all 0.15s',
                        }}>
                        {sub.status === 'completed' && (
                          <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8 }}>
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                      <span style={{
                        flex: 1, fontSize: 13, lineHeight: 1.4,
                        color: sub.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                      }}>
                        {sub.title}
                      </span>
                      {sub.due_date && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {sub.due_date}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Inline add subtask - always visible at bottom */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 20px', borderTop: subtasks.length > 0 ? '1px dashed var(--border)' : 'none',
                  marginTop: subtasks.length === 0 ? 0 : 4,
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: '2px dashed var(--brand)', opacity: 0.5,
                  }}/>
                  <input
                    value={newSubtitle}
                    onChange={e => setNewSubtitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newSubtitle.trim()) addSubtask()
                      if (e.key === 'Escape') setNewSubtitle('')
                    }}
                    placeholder="Add subtask… (Enter to save)"
                    style={{
                      flex: 1, fontSize: 13, border: 'none', outline: 'none',
                      background: 'transparent', color: 'var(--text-primary)',
                    }}
                  />
                  {addingSub && (
                    <span style={{ fontSize: 11, color: 'var(--brand)' }}>Saving…</span>
                  )}
                  {newSubtitle.trim() && !addingSub && (
                    <button onClick={addSubtask}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                        background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
                        flexShrink: 0,
                      }}>
                      Add
                    </button>
                  )}
                </div>

                {/* Progress */}
                {subtasks.length > 0 && (
                  <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--brand)', borderRadius: 99,
                        width: `${subtasks.length > 0 ? Math.round(subtasks.filter(s => s.status === 'completed').length / subtasks.length * 100) : 0}%`,
                        transition: 'width 0.3s ease',
                      }}/>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Attachments ── */}
            {tab === 'attachments' && (
              <div className="px-5 py-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl p-6 text-center cursor-pointer transition-colors mb-4"
                  style={{
                    border: '2px dashed var(--border)',
                    background: 'var(--surface-subtle)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--brand-light)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'
                  }}>
                  {uploading
                    ? <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Uploading…</p>
                    : <>
                      <div className="text-3xl mb-2">📎</div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Click to upload a file</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, Word, Excel, images · Max 20 MB</p>
                    </>
                  }
                  <input ref={fileInputRef} type="file" className="hidden" onChange={uploadFile}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"/>
                </div>
                {attachments.length === 0
                  ? <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No files attached yet</p>
                  : <div className="space-y-2">
                    {attachments.map(att => {
                      const isImg = att.mime_type?.startsWith('image/')
                      const icon  = att.mime_type?.includes('pdf') ? '📄' : isImg ? '🖼️' :
                                    att.mime_type?.includes('sheet') || att.mime_type?.includes('excel') ? '📊' :
                                    att.mime_type?.includes('word') ? '📝' : '📎'
                      const kb = att.file_size ? (att.file_size > 1024*1024
                        ? (att.file_size/1024/1024).toFixed(1) + ' MB'
                        : (att.file_size/1024).toFixed(0) + ' KB') : ''
                      return (
                        <div key={att.id}
                          className="flex items-center gap-3 p-3 rounded-xl group transition-colors"
                          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-2xl flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{att.file_name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{kb}{att.uploader?.name ? ` · ${att.uploader.name}` : ''}</p>
                          </div>
                          <button onClick={() => getSignedUrl(att.storage_path, att.file_name)}
                            className="text-xs font-medium px-2 py-1 rounded transition-colors flex-shrink-0"
                            style={{ color: 'var(--brand)' }}>
                            Download
                          </button>
                          <button onClick={() => deleteAttachment(att.id, att.storage_path)}
                            className="text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            style={{ color: '#f87171' }}>
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
            )}

            {/* ── Comments ── */}
            {tab === 'comments' && (
              <div className="px-5 py-4">
                <div className="flex gap-3 mb-4">
                  <Avatar name={myName} size="sm" />
                  <div className="flex-1">
                    <MentionTextarea
                      value={comment}
                      onChange={setComment}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment() }}
                      placeholder="Write a comment... (Cmd+Enter to send, @ to mention)"
                      rows={2}
                      members={members}
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none transition-all"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-primary)',
                      } as React.CSSProperties}
                    />
                    {comment.trim() && (
                      <button onClick={sendComment} disabled={sending}
                        className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'var(--brand)' }}>
                        <Send className="h-3 w-3" />{sending ? 'Sending...' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>
                {task.comments && (task.comments as any[]).length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {(task.comments as any[]).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((cm: any) => (
                      <div key={cm.id} className="flex gap-3">
                        <Avatar name={cm.author?.name ?? '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{cm.author?.name ?? 'Unknown'}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(cm.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                          </div>
                          <div className="text-sm rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'var(--text-primary)', background: 'var(--surface-subtle)', border: '1px solid var(--border-light)' }}>
                            <CommentText text={cm.content} members={members}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-6 mb-4" style={{ color: 'var(--text-muted)' }}>No comments yet — be the first to add one</p>
                )}
              </div>
            )}

            {/* ── Time ── */}
            {tab === 'time' && (
              <div className="px-5 py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Log time on the{' '}
                  <a href="/time" style={{ color: 'var(--brand)' }} className="underline">Time tracking</a>{' '}
                  page and link it to this task.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 last:border-0"
      style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div className="w-24 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </div>
  )
}