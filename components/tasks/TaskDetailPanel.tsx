'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ThumbsUp, ThumbsDown, Flag, Calendar, User, Briefcase, Send, Clock, Sparkles } from 'lucide-react'
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

  const [subtasks,      setSubtasks]      = useState<any[]>([])
  const [subtasksLoaded,setSubtasksLoaded]= useState(false)
  const [newSubtitle,   setNewSubtitle]   = useState('')
  const [addingSub,     setAddingSub]     = useState(false)
  const [attachments,   setAttachments]   = useState<any[]>([])
  const [attLoaded,     setAttLoaded]     = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (tab === 'subtasks' && task) loadSubtasks(task.id)
    if (tab === 'attachments' && task) loadAttachments(task.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, task?.id])

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

  /* Escape to close */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* generic PATCH helper */
  const patch = useCallback(async (fields: Record<string, unknown>) => {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Could not save')
      return
    }
    onUpdated?.()
    router.refresh()
  }, [task, onUpdated, router])

  /* complete toggle */
  async function handleComplete() {
    if (!task) return
    setCompleting(true)
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    setStatus(newStatus)
    await patch({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    })
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
    await fetch(`/api/tasks/${sub.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ns, completed_at: ns === 'completed' ? new Date().toISOString() : null }) })
    setSubtasks(p => p.map(s => s.id === sub.id ? { ...s, status: ns } : s))
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
        <div className="fixed inset-0 z-20 bg-black/10" onClick={onClose} />
      )}

      <aside className={cn('detail-panel', isOpen && 'open')} onClick={e => e.stopPropagation()}>
        {task && (
          <>
            {/* ── Panel header ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
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
              <span className={cn('text-xs font-medium flex-1', isCompleted ? 'text-green-600' : 'text-gray-400')}>
                {isCompleted ? '✓ Completed' : 'Mark complete'}
              </span>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Approval banners ── */}
            {isPending && isDesignatedApprover && (
              <div className="px-4 py-3 flex items-center gap-3 border-b border-amber-200" style={{ background: '#fffbeb' }}>
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
                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500 flex-shrink-0"/>
                <span className="text-violet-700">
                  Approver: <strong>{approverInfo.name}</strong>
                </span>
              </div>
            )}
            {task.approval_required && !approverInfo && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500 flex-shrink-0"/>
                <span className="text-violet-700">Any manager can approve this task</span>
              </div>
            )}
            {task.approval_status === 'rejected' && (
              <div className="px-4 py-2.5 border-b border-red-200" style={{ background: '#fef2f2' }}>
                <p className="text-xs font-semibold text-red-700">❌ Rejected — please revise and resubmit</p>
              </div>
            )}

            {task.approval_status === 'approved' && (
              <div className="px-4 py-2.5 border-b border-green-200" style={{ background: '#f0fdf4' }}>
                <p className="text-xs font-semibold text-green-700">✅ Approved</p>
              </div>
            )}

            {task.approval_required && !task.approval_status && isAssignee && status !== 'completed' && (
              <div className="px-4 py-2.5 border-b border-blue-200" style={{ background: '#eff6ff' }}>
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
                onChange={e => setTitle(e.target.value)}
                onBlur={() => title !== task.title && patch({ title })}
                rows={1}
                className={cn(
                  'w-full text-lg font-bold resize-none outline-none bg-transparent leading-snug',
                  isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
                )}
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={() => description !== (task.description ?? '') && patch({ description: description || null })}
                placeholder="Add a description..."
                rows={3}
                className="w-full mt-2 text-sm text-gray-500 resize-none outline-none bg-transparent leading-relaxed placeholder-gray-300"
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
              <div className="px-5 py-3">
                <FieldRow label="Status">
                  <select value={status} onChange={e => { setStatus(e.target.value); patch({ status: e.target.value }) }}
                    className="text-sm bg-transparent outline-none cursor-pointer text-gray-700 flex-1">
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Priority">
                  <Flag className="h-3.5 w-3.5" style={{ color: priConf.color }} />
                  <select value={priority} onChange={e => { setPriority(e.target.value); patch({ priority: e.target.value }) }}
                    className="text-sm bg-transparent outline-none cursor-pointer text-gray-700 flex-1">
                    {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Assignee">
                  {assigneeId && <Avatar name={assignee?.name ?? '?'} size="xs" />}
                  <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); patch({ assignee_id: e.target.value || null }) }}
                    className="text-sm bg-transparent outline-none cursor-pointer text-gray-700 flex-1">
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Due date">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <input type="date" value={dueDate}
                    onChange={e => { setDueDate(e.target.value); patch({ due_date: e.target.value || null }) }}
                    className="text-sm bg-transparent outline-none cursor-pointer flex-1"
                    style={{ color: overdue ? '#dc2626' : dueDate ? '#0f172a' : '#94a3b8' }}
                  />
                  {overdue && <span className="text-xs text-red-500 font-medium flex-shrink-0">Overdue</span>}
                </FieldRow>

                {clients.length > 0 && (
                  <FieldRow label="Client">
                    {clientId && <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: client?.color }} />}
                    <select value={clientId} onChange={e => { setClientId(e.target.value); patch({ client_id: e.target.value || null }) }}
                      className="text-sm bg-transparent outline-none cursor-pointer text-gray-700 flex-1">
                      <option value="">No client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FieldRow>
                )}

                <FieldRow label="Est. hours">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <input type="number" step="0.5" min="0" value={estHours}
                    onChange={e => setEstHours(e.target.value)}
                    onBlur={() => patch({ estimated_hours: estHours ? parseFloat(estHours) : null })}
                    placeholder="0"
                    className="text-sm bg-transparent outline-none text-gray-700 w-16"
                  />
                  {estHours && <span className="text-xs text-gray-400">hrs</span>}
                </FieldRow>

                {task.project && (
                  <FieldRow label="Project">
                    <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: (task.project as any).color }} />
                    <span className="text-sm text-gray-700">{(task.project as any).name}</span>
                  </FieldRow>
                )}
              </div>
            )}

            {/* ── Subtasks ── */}
            {tab === 'subtasks' && (
              <div className="px-5 py-4">
                {/* Add subtask input */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-4 w-4 rounded-full border-2 border-teal-400 flex-shrink-0"/>
                  <input
                    value={newSubtitle}
                    onChange={e => setNewSubtitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
                    placeholder="Add a subtask…"
                    className="flex-1 text-sm outline-none border-b border-gray-200 focus:border-teal-400 pb-1 transition-colors bg-transparent"
                  />
                  <button onClick={addSubtask} disabled={addingSub || !newSubtitle.trim()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors flex-shrink-0">
                    {addingSub ? '…' : 'Add'}
                  </button>
                </div>
                {/* Subtask list */}
                {subtasks.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-6">No subtasks yet — add one above</p>
                  : <div className="space-y-1">
                    {subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 group">
                        <button onClick={() => toggleSubtask(sub)}
                          className={cn('h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                            sub.status === 'completed' ? 'bg-teal-500 border-teal-500' : 'border-gray-300 hover:border-teal-400')}>
                          {sub.status === 'completed' && <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                        </button>
                        <span className={cn('flex-1 text-sm', sub.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800')}>
                          {sub.title}
                        </span>
                        {sub.due_date && <span className="text-xs text-gray-400">{sub.due_date}</span>}
                      </div>
                    ))}
                  </div>
                }
                <p className="text-xs text-gray-400 mt-3 text-center">
                  {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length} completed
                </p>
              </div>
            )}

            {/* ── Attachments ── */}
            {tab === 'attachments' && (
              <div className="px-5 py-4">
                {/* Upload button */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors mb-4">
                  {uploading
                    ? <p className="text-sm text-teal-600 font-medium">Uploading…</p>
                    : <>
                      <div className="text-3xl mb-2">📎</div>
                      <p className="text-sm font-medium text-gray-700">Click to upload a file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, images · Max 20 MB</p>
                    </>
                  }
                  <input ref={fileInputRef} type="file" className="hidden" onChange={uploadFile}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"/>
                </div>
                {/* Attachment list */}
                {attachments.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-4">No files attached yet</p>
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
                        <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 group hover:border-gray-200 transition-colors">
                          <span className="text-2xl flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{att.file_name}</p>
                            <p className="text-xs text-gray-400">{kb}{att.uploader?.name ? ` · ${att.uploader.name}` : ''}</p>
                          </div>
                          <button onClick={() => getSignedUrl(att.storage_path, att.file_name)}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors flex-shrink-0">
                            Download
                          </button>
                          <button onClick={() => deleteAttachment(att.id, att.storage_path)}
                            className="text-xs text-red-400 hover:text-red-600 px-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
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
                {/* Render existing comments */}
                {task.comments && (task.comments as any[]).length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {(task.comments as any[]).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((cm: any) => (
                      <div key={cm.id} className="flex gap-3">
                        <Avatar name={cm.author?.name ?? '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-900">{cm.author?.name ?? 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{new Date(cm.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                          </div>
                          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap border border-gray-100">
                            <CommentText text={cm.content} members={members}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6 mb-4">No comments yet — be the first to add one</p>
                )}
              </div>
            )}

            {/* ── Time ── */}
            {tab === 'time' && (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">
                  Log time on the{' '}
                  <a href="/time" className="text-teal-600 underline">Time tracking</a>{' '}
                  page and link it to this task.
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-24 text-xs text-gray-400 flex-shrink-0">{label}</div>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </div>
  )
}
