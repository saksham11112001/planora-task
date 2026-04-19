'use client'
// Custom fields panel
import { CustomFieldsPanel } from '@/components/tasks/CustomFieldsPanel'
import type { CustomFieldDef } from '@/components/tasks/CustomFieldsPanel'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ThumbsUp, ThumbsDown, Flag, Calendar, User, Briefcase, Send, Clock, Sparkles, ShieldCheck, RefreshCw, FolderPlus, ArrowRightLeft, ExternalLink, Link2 } from 'lucide-react'
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
  onUpdated?:     (fields?: Record<string, unknown>) => void
}

export function TaskDetailPanel({ task, members, clients, currentUserId, userRole, onClose, onUpdated }: Props) {
  const isOpen     = !!task
  const canManage      = ['owner', 'admin', 'manager'].includes(userRole ?? '')
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole ?? '')
  // Designated approver: if task has approver_id, only that person (or any owner/admin) can approve/reject
  // If no approver set, any manager can
  const isDesignatedApprover = task?.approver_id
    ? task.approver_id === currentUserId || isOwnerOrAdmin
    : canManage
  const approverInfo = (task as any)?.approver as unknown as { id: string; name: string } | null
  const isAssignee = task?.assignee_id === currentUserId
  // canEdit: only managers or the main task assignee can edit the parent task
  const canEdit = canManage || isAssignee

  /* local editable state */
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [status,      setStatus]      = useState('todo')
  const [priority,    setPriority]    = useState('medium')
  const [assigneeId,  setAssigneeId]  = useState('')
  const [clientId,    setClientId]    = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [completing,  setCompleting]  = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [comment,     setComment]     = useState('')
  const [sending,     setSending]     = useState(false)
  const [tab,         setTab]         = useState<'details' | 'attachments' | 'comments' | 'time' | 'activity'>('details')
  const [activityLog,      setActivityLog]      = useState<any[]>([])
  const [activityLoaded,   setActivityLoaded]   = useState(false)
  const [activityLoading,  setActivityLoading]  = useState(false)
  const [subtasksOpen,    setSubtasksOpen]    = useState(true)
  const [blockingSearch,  setBlockingSearch]  = useState('')
  const [blockingResults, setBlockingResults] = useState<{id:string;title:string}[]>([])
  const [blockingTasks,   setBlockingTasks]   = useState<{id:string;title:string}[]>([])
  // "Blocks" = tasks that THIS task is blocking (reverse of _blocked_by)
  const [blocksTasks,     setBlocksTasks]     = useState<{id:string;title:string;status:string}[]>([])
  const [blocksSearch,    setBlocksSearch]    = useState('')
  const [blocksResults,   setBlocksResults]   = useState<{id:string;title:string}[]>([])
  const [comments,        setComments]        = useState<any[]>([])
  const [commentsLoaded,  setCommentsLoaded]  = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([])

  const [subtasks,      setSubtasks]      = useState<any[]>([])
  const [subtasksLoaded,setSubtasksLoaded]= useState(false)
  const [nilSubtaskId,  setNilSubtaskId]  = useState<string | null>(null)
  const [newSubtitle,      setNewSubtitle]      = useState('')
  const [newSubAssigneeId, setNewSubAssigneeId] = useState('')
  const [newSubDueDate,    setNewSubDueDate]    = useState('')
  const [addingSub,        setAddingSub]        = useState(false)
  const [attachments,   setAttachments]   = useState<any[]>([])
  const [attLoaded,     setAttLoaded]     = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [attachMode,    setAttachMode]    = useState<'file'|'link'>('file')
  const [driveUrl,      setDriveUrl]      = useState('')
  const [driveTitle,    setDriveTitle]    = useState('')
  const [caHeaders,     setCaHeaders]     = useState<string[]>([])
  const [previewAtt,   setPreviewAtt]   = useState<{ url: string; mimeType: string; name: string; storagePath: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [isSaving,  setIsSaving]  = useState(false)
  const [converting, setConverting] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Fallback: if pre-fetch didn't load yet, load on tab switch or on open
  useEffect(() => {
    if (!task) return
    if (!subtasksLoaded) loadSubtasks(task.id)
    if (tab === 'attachments' && !attLoaded) loadAttachments(task.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, task?.id, subtasksLoaded])

  /* load org custom field definitions once on mount */
  useEffect(() => {
    fetch('/api/settings/custom-fields')
      .then(r => r.json())
      .then(d => setCustomFieldDefs(d.data ?? []))
      .catch(() => {})
  }, [])

  /* sync from task + eagerly pre-fetch all tab data in parallel */
  useEffect(() => {
    if (!task) return
    setSubtasksLoaded(false); setAttLoaded(false)
    setSubtasks([]); setAttachments([]); setCaHeaders([])
    setComments([]); setCommentsLoaded(false)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setStatus(task.status)
    setPriority(task.priority)
    setAssigneeId(task.assignee_id ?? '')
    setClientId(task.client_id ?? '')
    setDueDate(task.due_date ?? '')
    setTab('details')
    setActivityLog([])
    setActivityLoaded(false)
    setBlockingTasks([])
    setBlockingSearch('')
    setBlockingResults([])
    setBlocksTasks([])
    setBlocksSearch('')
    setBlocksResults([])

    // Load "blocked by" task titles when task changes
    if ((task as any).custom_fields?._blocked_by?.length) {
      const ids: string[] = (task as any).custom_fields._blocked_by
      Promise.all(ids.map(id => fetch(`/api/tasks/${id}`).then(r => r.json()).catch(() => null)))
        .then(results => {
          setBlockingTasks(results.filter(Boolean).map((d: any) => ({ id: d.data?.id, title: d.data?.title })).filter((t: any) => t.id))
        })
    }

    // Load "blocks" tasks — tasks that this task is blocking (reverse lookup)
    fetch(`/api/tasks?blocks_task_id=${task.id}&limit=50`)
      .then(r => r.json())
      .then(d => setBlocksTasks((d.data ?? []).map((t: any) => ({ id: t.id, title: t.title, status: t.status }))))
      .catch(() => {})

    // Pre-fetch subtasks + attachments in parallel so all tabs are instant
    const taskId = task.id
    Promise.all([
      fetch(`/api/tasks?parent_id=${taskId}&limit=50`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/tasks/${taskId}/attachments`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([subData, attData]) => {
      setSubtasks(subData.data ?? [])
      setSubtasksLoaded(true)
      setAttachments(attData.data ?? [])
      setAttLoaded(true)
    })

    // CA compliance attachment headers
    const isCaCompliance = (task as any).custom_fields?._ca_compliance === true ||
      (task as any).custom_fields?._compliance_subtask === true
    if (isCaCompliance) {
      fetch(`/api/ca/master?name=${encodeURIComponent(task.title)}`)
        .then(r => r.json())
        .then(d => {
          const row = Array.isArray(d.data) ? d.data[0] : d.data
          if (row?.attachment_headers?.length) setCaHeaders(row.attachment_headers)
        })
        .catch(() => {})
    }
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
    // Read server response to capture server-side implicit changes
    // (e.g. approval_status/completed_at cleared on reopen, parent auto-complete)
    const { data: serverData } = await res.json().catch(() => ({}))
    onUpdated?.(serverData && typeof serverData === 'object' ? { ...fields, ...serverData } : fields)
  }, [task, onUpdated])

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

  /* complete / reopen toggle — all completions go through approval (no direct complete) */
  async function handleComplete() {
    if (!task) return
    setCompleting(true)

    // Reopen: completed or in_review → todo
    if (status === 'completed' || status === 'in_review') {
      const prevStatus = status
      const prevApproval = task.approval_status
      setStatus('todo')
      await patch(
        { status: 'todo', completed_at: null },
        () => setStatus(prevStatus),
      )
      setCompleting(false)
      return
    }

    // Already pending — just inform
    if (task.approval_status === 'pending') {
      toast.info('Already submitted — awaiting approver.')
      setCompleting(false)
      return
    }

    // All other tasks: submit for approval (optimistic → in_review)
    const prevStatus = status
    setStatus('in_review')
    const res = await fetch(`/api/tasks/${task.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'submit' }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      if (d.auto_completed) {
        setStatus('completed')
        toast.success('Task completed ✓')
        onUpdated?.({ status: 'completed', approval_status: 'approved' })
      } else {
        toast.success('Submitted for approval ✓')
        onUpdated?.({ status: 'in_review', approval_status: 'pending' })
      }
    } else {
      setStatus(prevStatus)   // rollback
      toast.error(d.error ?? 'Could not submit — please try again')
    }
    setCompleting(false)
  }

  /* ── approve / reject go through /approve endpoint with optimistic updates ── */
  async function callApproveAPI(decision: 'approve' | 'reject' | 'submit') {
    if (!task) return
    setApproving(true)

    // Optimistic status update
    const prevStatus = status
    if (decision === 'approve') setStatus('completed')
    if (decision === 'reject')  setStatus('todo')
    if (decision === 'submit')  setStatus('in_review')

    const res = await fetch(`/api/tasks/${task.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    const d = await res.json()
    setApproving(false)
    if (!res.ok) {
      setStatus(prevStatus)   // rollback
      toast.error(d.error ?? 'Action failed')
      return
    }
    if (decision === 'approve') toast.success('Task approved! ✅')
    if (decision === 'reject')  toast.info('Task rejected — sent back to assignee')
    if (decision === 'submit') {
      if ((d as any).auto_completed) {
        toast.success('Task completed ✓')
      } else {
        toast.success('Submitted for approval ✓')
      }
    }
    const newStatus = decision === 'approve' ? 'completed'
      : decision === 'reject' ? 'todo'
      : (decision === 'submit' && (d as any).auto_completed) ? 'completed'
      : 'in_review'
    const newApprovalStatus = decision === 'approve' ? 'approved'
      : decision === 'reject' ? 'rejected'
      : (decision === 'submit' && (d as any).auto_completed) ? 'approved'
      : 'pending'
    onUpdated?.({ status: newStatus, approval_status: newApprovalStatus })
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
      body: JSON.stringify({
        title: newSubtitle.trim(), parent_task_id: task.id,
        project_id: task.project_id ?? null,
        assignee_id: newSubAssigneeId || task.assignee_id || null,
        due_date: newSubDueDate || null,
      }),
    })
    const d = await r.json()
    if (r.ok) {
      setSubtasks(p => [...p, d.data])
      setNewSubtitle('')
      setNewSubAssigneeId('')
      setNewSubDueDate('')
    }
    setAddingSub(false)
  }

  async function toggleSubtask(sub: any) {
    setNilSubtaskId(null) // clear any open nil confirmation strip for another subtask
    const ns = sub.status === 'completed' ? 'todo' : 'completed'

    // CA compliance subtasks REQUIRE an attachment (file or link) before completing.
    // Accept attachments on the subtask itself OR on the parent task (users often
    // attach a Drive folder link at the parent level to cover all subtasks).
    if (ns === 'completed' && sub.custom_fields?._compliance_subtask) {
      const [subAttRes, parentAttRes] = await Promise.all([
        fetch(`/api/tasks/${sub.id}/attachments`),
        task ? fetch(`/api/tasks/${task.id}/attachments`) : Promise.resolve(null),
      ])
      const subAtt    = await subAttRes.json().catch(() => ({ data: [] }))
      const parentAtt = parentAttRes ? await parentAttRes.json().catch(() => ({ data: [] })) : { data: [] }
      const total = (subAtt.data ?? []).length + (parentAtt.data ?? []).length
      if (total === 0) {
        setNilSubtaskId(sub.id)
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
      const d = await res.json().catch(() => ({}))
      // If the API says attachment is required, show the nil strip instead of an error toast
      if ((d as any).code === 'ATTACHMENT_REQUIRED') {
        setNilSubtaskId(sub.id)
      } else {
        toast.error((d as any).error ?? 'Could not update subtask')
      }
    }
  }

  async function markSubtaskNil(sub: any) {
    // Store a nil attachment on the subtask then mark it complete
    await fetch(`/api/tasks/${sub.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive_url: 'nil', file_name: 'Not available (nil)', attachment_type: 'link' }),
    })
    setNilSubtaskId(null)
    setSubtasks(p => p.map(s => s.id === sub.id ? { ...s, status: 'completed' } : s))
    const res = await fetch(`/api/tasks/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })
    if (!res.ok) {
      setSubtasks(p => p.map(s => s.id === sub.id ? { ...s, status: sub.status } : s))
      const d = await res.json().catch(() => ({}))
      toast.error((d as any).error ?? 'Could not update subtask')
    } else {
      toast.success('Subtask marked as not available')
    }
  }

  async function searchBlockingTasks(q: string) {
    if (!q.trim() || q.trim().length < 2) { setBlockingResults([]); return }
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const d = await r.json()
      setBlockingResults((d.data ?? []).filter((x: any) => x.type === 'task' && x.id !== task?.id).slice(0, 8).map((x: any) => ({ id: x.id, title: x.title })))
    } catch {}
  }

  async function addBlockedBy(blockingTaskId: string) {
    if (!task) return
    const current: string[] = (task as any).custom_fields?._blocked_by ?? []
    if (current.includes(blockingTaskId)) { setBlockingSearch(''); setBlockingResults([]); return }
    const newBlockedBy = [...current, blockingTaskId]
    setBlockingSearch(''); setBlockingResults([])
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_fields: { _blocked_by: newBlockedBy } }),
    })
    if (res.ok) {
      const tr = await fetch(`/api/tasks/${blockingTaskId}`)
      const td = await tr.json()
      if (td.data) setBlockingTasks(p => [...p.filter(t => t.id !== blockingTaskId), { id: blockingTaskId, title: td.data.title }])
      onUpdated?.({ custom_fields: { ...(task as any).custom_fields, _blocked_by: newBlockedBy } })
      toast.success('Blocking task added')
    } else toast.error('Failed to add dependency')
  }

  async function removeBlockedBy(blockingTaskId: string) {
    if (!task) return
    const newBlockedBy = ((task as any).custom_fields?._blocked_by ?? []).filter((id: string) => id !== blockingTaskId)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_fields: { _blocked_by: newBlockedBy } }),
    })
    if (res.ok) {
      onUpdated?.({ custom_fields: { ...(task as any).custom_fields, _blocked_by: newBlockedBy } })
      toast.success('Dependency removed')
    } else toast.error('Failed to remove dependency')
  }

  /* ── "Blocks" reverse side: this task blocks other tasks ──────── */
  async function searchBlocksTasks(q: string) {
    if (!q.trim() || q.trim().length < 2) { setBlocksResults([]); return }
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const d = await r.json()
      setBlocksResults((d.data ?? []).filter((x: any) => x.type === 'task' && x.id !== task?.id).slice(0, 8).map((x: any) => ({ id: x.id, title: x.title })))
    } catch {}
  }

  // Adding "this task blocks task X" = writing task X's _blocked_by to include this task's id
  async function addBlocksTask(targetTaskId: string) {
    if (!task) return
    if (blocksTasks.some(t => t.id === targetTaskId)) { setBlocksSearch(''); setBlocksResults([]); return }
    setBlocksSearch(''); setBlocksResults([])
    // Fetch target task's current custom_fields
    const tr = await fetch(`/api/tasks/${targetTaskId}`)
    const td = await tr.json()
    if (!td.data) { toast.error('Task not found'); return }
    const currentBlockedBy: string[] = td.data.custom_fields?._blocked_by ?? []
    if (currentBlockedBy.includes(task.id)) {
      // Already linked — just refresh local state
      setBlocksTasks(p => [...p, { id: targetTaskId, title: td.data.title, status: td.data.status }])
      return
    }
    const res = await fetch(`/api/tasks/${targetTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_fields: { _blocked_by: [...currentBlockedBy, task.id] } }),
    })
    if (res.ok) {
      setBlocksTasks(p => [...p, { id: targetTaskId, title: td.data.title, status: td.data.status }])
      toast.success(`"${td.data.title}" is now blocked by this task`)
    } else toast.error('Failed to add block link')
  }

  // Remove "this task blocks task X" = remove this task's id from task X's _blocked_by
  async function removeBlocksTask(targetTaskId: string) {
    if (!task) return
    const tr = await fetch(`/api/tasks/${targetTaskId}`)
    const td = await tr.json()
    if (!td.data) { toast.error('Task not found'); return }
    const newBlockedBy = (td.data.custom_fields?._blocked_by ?? []).filter((id: string) => id !== task.id)
    const res = await fetch(`/api/tasks/${targetTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_fields: { _blocked_by: newBlockedBy } }),
    })
    if (res.ok) {
      setBlocksTasks(p => p.filter(t => t.id !== targetTaskId))
      toast.success('Block link removed')
    } else toast.error('Failed to remove block link')
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

  async function viewAttachment(storagePath: string, mimeType: string, fileName: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data } = await sb.storage.from('attachments').createSignedUrl(storagePath, 300)
    if (!data?.signedUrl) return
    const isImage = mimeType?.startsWith('image/')
    const isPdf   = mimeType?.includes('pdf')
    const isVideo = mimeType?.startsWith('video/')
    if (isImage || isPdf || isVideo) {
      setPreviewAtt({ url: data.signedUrl, mimeType, name: fileName, storagePath })
    } else {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function downloadAttachment(storagePath: string, fileName: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data } = await sb.storage.from('attachments').createSignedUrl(storagePath, 60, { download: fileName })
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl; a.click()
    }
  }

  async function addDriveLink() {
    if (!task || !driveUrl.trim()) return
    const trimmedUrl = driveUrl.trim()
    const isNil = trimmedUrl.toLowerCase() === 'nil'
    if (!isNil) {
      try { new URL(trimmedUrl) } catch {
        toast.error('Please enter a valid URL (must start with https://) or type nil if not available')
        return
      }
    }
    setUploading(true)
    const r = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drive_url: isNil ? 'nil' : trimmedUrl,
        file_name: isNil ? 'Not available (nil)' : (driveTitle.trim() || trimmedUrl),
        attachment_type: 'link',
      }),
    })
    const d = await r.json()
    if (r.ok) {
      setAttachments(p => [d.data, ...p])
      setDriveUrl(''); setDriveTitle('')
      toast.success(isNil ? 'Marked as not available' : 'Link added')
    } else {
      toast.error(d.error ?? 'Failed to add link')
    }
    setUploading(false)
  }

  async function fetchComments(taskId: string) {
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`)
      if (res.ok) {
        const d = await res.json()
        setComments(d.data ?? [])
        setCommentsLoaded(true)
      }
    } finally {
      setLoadingComments(false)
    }
  }

  // Load comments when comments tab is opened or task changes
  useEffect(() => {
    if (tab === 'comments' && task?.id) {
      setCommentsLoaded(false)
      fetchComments(task.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, task?.id])

  // Load activity log when activity tab is opened
  useEffect(() => {
    if (tab === 'activity' && task?.id && !activityLoaded) {
      setActivityLoading(true)
      fetch(`/api/tasks/${task.id}/activity`)
        .then(r => r.json())
        .then(d => { setActivityLog(d.data ?? []); setActivityLoaded(true) })
        .catch(() => setActivityLog([]))
        .finally(() => setActivityLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, task?.id])

  async function sendComment() {
    if (!comment.trim() || !task) return
    setSending(true)
    const myName = members.find(m => m.id === currentUserId)?.name ?? 'You'
    // Optimistic: add immediately
    const optimistic = {
      id: `temp-${Date.now()}`,
      content: comment.trim(),
      created_at: new Date().toISOString(),
      author: { id: currentUserId, name: myName },
    }
    setComments(prev => [...prev, optimistic])
    setComment('')
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: optimistic.content }),
    })
    setSending(false)
    if (res.ok) {
      // Replace optimistic with real data
      fetchComments(task.id)
    } else {
      // Roll back
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      toast.error('Could not post comment')
    }
  }

  const isCompleted = status === 'completed'
  const isInReview  = status === 'in_review'
  const isPending   = task?.approval_status === 'pending' || isInReview
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
              {canEdit ? (
                <button
                  onClick={handleComplete}
                  className={cn('task-check flex-shrink-0', isCompleted && 'done', isInReview && 'popping', completing && 'popping')}
                  title={isCompleted ? 'Mark incomplete' : isInReview ? 'Pending approval — click to reopen' : 'Submit for approval'}
                >
                  {(isCompleted || isInReview) && (
                    <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                      <path d="M13 4L6.5 11 3 7.5" stroke={isInReview ? '#7c3aed' : 'white'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="task-check flex-shrink-0" style={{ opacity: 0.3, cursor: 'not-allowed' }} title="Only the task assignee can submit this task" />
              )}
              <span className="text-xs font-medium flex-1" style={{ color: isCompleted ? '#16a34a' : isInReview ? '#7c3aed' : 'var(--text-muted)' }}>
                {isCompleted ? '✓ Completed' : isInReview ? '⏳ Pending approval' : canEdit ? 'Submit for approval' : 'View only'}
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
            {task.approval_required && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500 flex-shrink-0"/>
                <span className="text-violet-700">
                  {approverInfo
                    ? <>Approver: <strong>{approverInfo.name}</strong></>
                    : task.approver_id
                    ? 'Approver assigned (pending registration)'
                    : 'Any manager can approve this task'}
                </span>
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
                onChange={e => { if (!canEdit) return; setTitle(e.target.value); patchDebounced({ title: e.target.value }) }}
                onBlur={() => { if (!canEdit) return; if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; if (task && title !== task.title) patch({ title }) } }}
                rows={1}
                readOnly={!canEdit}
                className={cn(
                  'w-full text-lg font-bold resize-none outline-none bg-transparent leading-snug',
                  isCompleted ? 'line-through' : '',
                  !canEdit ? 'cursor-default select-text' : ''
                )}
                style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
              />
              <textarea
                value={description}
                onChange={e => { if (!canEdit) return; setDescription(e.target.value); patchDebounced({ description: e.target.value || null }, 800) }}
                onBlur={() => { if (!canEdit) return; if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; if (task && description !== (task.description ?? '')) patch({ description: description || null }) } }}
                placeholder={canEdit ? 'Add a description...' : ''}
                rows={3}
                readOnly={!canEdit}
                className="w-full mt-2 text-sm resize-none outline-none bg-transparent leading-relaxed"
                style={{ color: 'var(--text-secondary)', caretColor: 'var(--brand)', cursor: canEdit ? undefined : 'default' }}
              />
            </div>

            {/* ── Subtasks (always-visible inline section) ── */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Collapsible header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px 6px',
                borderBottom: subtasksOpen ? '1px solid var(--border-light)' : 'none' }}>
                <button
                  onClick={() => setSubtasksOpen(o => !o)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 10 }}>{subtasksOpen ? '▾' : '▸'}</span>
                  SUBTASKS
                </button>
                {subtasks.length > 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--brand)', borderRadius: 99,
                        width: `${Math.round(subtasks.filter(s => s.status === 'completed').length / subtasks.length * 100)}%`,
                        transition: 'width 0.3s ease',
                      }}/>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length}
                    </span>
                  </div>
                )}
                {canEdit && (
                  <button
                    onClick={() => { setSubtasksOpen(true); }}
                    title="Add subtask"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center' }}>
                    +
                  </button>
                )}
              </div>

              {subtasksOpen && (
                <div style={{ padding: '4px 0' }}>
                  {subtasks.length === 0 && (
                    <div style={{ padding: '8px 20px 4px', textAlign: 'center' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No subtasks yet</p>
                    </div>
                  )}
                  <div>
                    {subtasks.map(sub => {
                      const subAssignee = sub.assignee_id ? members.find(m => m.id === sub.assignee_id) : null
                      const canToggleSub = canEdit || sub.assignee_id === currentUserId
                      return (
                        <div key={sub.id}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 20px', borderBottom: nilSubtaskId === sub.id ? 'none' : '1px solid var(--border-light)',
                            background: 'var(--surface)' }}
                          className="group">
                          <button onClick={() => canToggleSub && toggleSubtask(sub)}
                            style={{
                              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'}`,
                              background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: canToggleSub ? 'pointer' : 'not-allowed',
                              opacity: canToggleSub ? 1 : 0.4,
                              padding: 0, transition: 'all 0.15s',
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
                          {subAssignee && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0,
                              display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ width:16, height:16, borderRadius:'50%', background:'var(--brand-light)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:9, fontWeight:700, color:'var(--brand)', flexShrink:0 }}>
                                {subAssignee.name[0]?.toUpperCase()}
                              </span>
                              <span>{subAssignee.name}</span>
                            </span>
                          )}
                          {sub.due_date && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                              {sub.due_date}
                            </span>
                          )}
                        </div>
                        {/* Nil confirmation — shown when user tries to complete with no attachment */}
                        {nilSubtaskId === sub.id && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 20px 8px', borderBottom: '1px solid var(--border-light)',
                            background: 'rgba(217,119,6,0.06)', borderLeft: '3px solid #d97706',
                          }}>
                            <span style={{ fontSize: 11, color: '#92400e', flex: 1 }}>
                              No document found. Mark as <strong>not available (nil)</strong>?
                            </span>
                            <button
                              onClick={() => markSubtaskNil(sub)}
                              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Mark N/A
                            </button>
                            <button
                              onClick={() => setNilSubtaskId(null)}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                                background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)',
                                cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancel
                            </button>
                          </div>
                        )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Inline add subtask - title + assignee + due date on ONE row */}
                  {canEdit && (
                    <div style={{
                      padding: '6px 20px',
                      borderTop: subtasks.length > 0 ? '1px dashed var(--border)' : 'none',
                      marginTop: subtasks.length === 0 ? 0 : 2,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                          border: '2px dashed var(--brand)', opacity: 0.4,
                        }}/>
                        <input
                          value={newSubtitle}
                          onChange={e => setNewSubtitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newSubtitle.trim()) addSubtask()
                            if (e.key === 'Escape') { setNewSubtitle(''); setNewSubAssigneeId(''); setNewSubDueDate('') }
                          }}
                          placeholder="Add subtask…"
                          style={{
                            flex: 1, minWidth: 80, fontSize: 12, border: 'none', outline: 'none',
                            background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit',
                          }}
                        />
                        <select
                          value={newSubAssigneeId}
                          onChange={e => setNewSubAssigneeId(e.target.value)}
                          style={{
                            fontSize: 11, padding: '3px 6px', borderRadius: 6, flexShrink: 0,
                            border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                            color: newSubAssigneeId ? 'var(--text-primary)' : 'var(--text-muted)',
                            outline: 'none', cursor: 'pointer', fontFamily: 'inherit', maxWidth: 90,
                          }}
                        >
                          <option value="">Assignee…</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>)}
                        </select>
                        <input
                          type="date"
                          value={newSubDueDate}
                          onChange={e => setNewSubDueDate(e.target.value)}
                          style={{
                            fontSize: 11, padding: '3px 6px', borderRadius: 6, flexShrink: 0,
                            border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                            color: newSubDueDate ? 'var(--text-primary)' : 'var(--text-muted)',
                            outline: 'none', colorScheme: 'light dark', fontFamily: 'inherit', width: 100,
                          }}
                        />
                        {newSubtitle.trim() && (
                          addingSub ? (
                            <span style={{ fontSize: 11, color: 'var(--brand)', flexShrink: 0 }}>…</span>
                          ) : (
                            <button onClick={addSubtask}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
                                flexShrink: 0, fontFamily: 'inherit',
                              }}>
                              Add
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Convert task actions (top of panel) ── */}
            {!task.is_recurring && canEdit && (
              <div style={{
                padding: '6px 20px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowRightLeft style={{ width: 10, height: 10 }}/>
                  Convert
                </span>
                <button
                  onClick={convertToRecurring}
                  disabled={converting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'rgba(13,148,136,0.1)', color: 'var(--brand)',
                    border: '1px solid rgba(13,148,136,0.25)', cursor: 'pointer',
                    opacity: converting ? 0.6 : 1, transition: 'all 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(13,148,136,0.18)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(13,148,136,0.1)'}>
                  <RefreshCw style={{ width: 10, height: 10 }}/>
                  Make recurring
                </button>
                {!task.project_id && (
                  <button
                    onClick={addToProject}
                    disabled={converting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
                      border: '1px solid rgba(124,58,237,0.25)', cursor: 'pointer',
                      opacity: converting ? 0.6 : 1, transition: 'all 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.1)'}>
                    <FolderPlus style={{ width: 10, height: 10 }}/>
                    Add to project
                  </button>
                )}
              </div>
            )}

            {/* ── Tabs ── */}
            <div className="tab-bar px-5">
              {(['details', 'attachments', 'comments', 'time', 'activity'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={cn('tab-item capitalize', tab === t && 'active')}>
                  {t === 'attachments' ? '📎 Files' : t === 'activity' ? '🕐 History' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Details ── */}
            {tab === 'details' && (
              <>
              <div className="px-5 py-3">
                <FieldRow label="Status">
                  <select value={status} onChange={e => { if (!canEdit) return; const prev = status; setStatus(e.target.value); patch({ status: e.target.value }, () => setStatus(prev)) }}
                    disabled={!canEdit}
                    className="text-sm bg-transparent outline-none flex-1"
                    style={{ color: 'var(--text-primary)', cursor: canEdit ? 'pointer' : 'default' }}>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Priority">
                  <Flag className="h-3.5 w-3.5" style={{ color: priConf.color }} />
                  <select value={priority} onChange={e => { if (!canEdit) return; const prev = priority; setPriority(e.target.value); patch({ priority: e.target.value }, () => setPriority(prev)) }}
                    disabled={!canEdit}
                    className="text-sm bg-transparent outline-none flex-1"
                    style={{ color: 'var(--text-primary)', cursor: canEdit ? 'pointer' : 'default' }}>
                    {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </FieldRow>

                <FieldRow label="Assignee">
                  {assigneeId && <Avatar name={assignee?.name ?? '?'} size="xs" />}
                  <select value={assigneeId} onChange={e => {
                    if (!canEdit) return
                    const prev = assigneeId
                    const newId = e.target.value || null
                    setAssigneeId(e.target.value)
                    // If subtasks share the old assignee, update them too
                    if (prev && newId !== prev) {
                      const matching = subtasks.filter(s => s.assignee_id === prev)
                      if (matching.length > 0) {
                        setSubtasks(p => p.map(s => s.assignee_id === prev ? { ...s, assignee_id: newId } : s))
                        matching.forEach(s => fetch(`/api/tasks/${s.id}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ assignee_id: newId }),
                        }))
                      }
                    }
                    patch({ assignee_id: newId }, () => setAssigneeId(prev))
                  }}
                    disabled={!canEdit}
                    className="text-sm bg-transparent outline-none flex-1"
                    style={{ color: 'var(--text-primary)', cursor: canEdit ? 'pointer' : 'default' }}>
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
                    ))}
                  </select>
                </FieldRow>

                {/* Assigned by */}
                {(() => {
                  const creator = members.find(m => m.id === (task as any).created_by)
                  if (!creator) return null
                  return (
                    <FieldRow label="Assigned by">
                      <Avatar name={creator.name} size="xs" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{creator.name}</span>
                    </FieldRow>
                  )
                })()}

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
                    onChange={e => { if (!canEdit) return; const prev = dueDate; setDueDate(e.target.value); patch({ due_date: e.target.value || null }, () => setDueDate(prev)) }}
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    className="text-sm outline-none flex-1 rounded-md px-2 py-1"
                    style={{
                      color: overdue ? '#dc2626' : dueDate ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border)',
                      colorScheme: 'light dark',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                  />
                  {overdue && <span className="text-xs text-red-500 font-medium flex-shrink-0">Overdue</span>}
                </FieldRow>

                {clients.length > 0 && (
                  <FieldRow label="Client">
                    {clientId && <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: client?.color }} />}
                    <select value={clientId} onChange={e => { if (!canEdit) return; setClientId(e.target.value); patch({ client_id: e.target.value || null }) }}
                      disabled={!canEdit}
                      className="text-sm bg-transparent outline-none flex-1"
                      style={{ color: 'var(--text-primary)', cursor: canEdit ? 'pointer' : 'default' }}>
                      <option value="">No client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FieldRow>
                )}

                {task.project && (
                  <FieldRow label="Project">
                    <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: (task.project as any).color }} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{(task.project as any).name}</span>
                  </FieldRow>
                )}

                {/* Dependencies: Blocked by */}
                <FieldRow label="Blocked by">
                  <Link2 className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }}/>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {((task as any).custom_fields?._blocked_by ?? []).map((bid: string) => {
                      return (
                        <div key={bid} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 8px', borderRadius:6,
                          background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.2)', fontSize:11 }}>
                          <span style={{ flex:1, color:'var(--text-secondary)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {blockingTasks.find(t => t.id === bid)?.title ?? bid}
                          </span>
                          {canEdit && (
                            <button onClick={() => removeBlockedBy(bid)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:0, display:'flex', flexShrink:0 }}>
                              <X style={{ width:10, height:10 }}/>
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {canEdit && (
                      <div style={{ position:'relative' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input
                            value={blockingSearch}
                            onChange={e => { setBlockingSearch(e.target.value); searchBlockingTasks(e.target.value) }}
                            onBlur={() => setTimeout(() => setBlockingResults([]), 150)}
                            placeholder="Search task to block by…"
                            style={{ flex:1, fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                              background:'var(--surface-subtle)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit', width:'100%' }}
                          />
                        </div>
                        {blockingResults.length > 0 && (
                          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
                            boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:200, maxHeight:140, overflowY:'auto', marginTop:2 }}>
                            {blockingResults.map(t => (
                              <button key={t.id} onClick={() => addBlockedBy(t.id)}
                                style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'6px 10px',
                                  border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontSize:11,
                                  color:'var(--text-primary)', fontFamily:'inherit' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--surface-subtle)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                                <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{t.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </FieldRow>

                {/* Dependencies: Blocks (tasks this task is blocking) */}
                {(blocksTasks.length > 0 || canEdit) && (
                  <FieldRow label="Blocks">
                    <ArrowRightLeft className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }}/>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {blocksTasks.map(t => (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 8px', borderRadius:6,
                          background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.25)', fontSize:11 }}>
                          <span style={{
                            width:6, height:6, borderRadius:'50%', flexShrink:0,
                            background: t.status === 'completed' ? '#16a34a' : t.status === 'in_progress' ? '#2563eb' : '#94a3b8',
                          }}/>
                          <span style={{ flex:1, color:'var(--text-secondary)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {t.title}
                          </span>
                          <span style={{ fontSize:10, color: t.status === 'completed' ? '#16a34a' : 'var(--text-muted)', flexShrink:0 }}>
                            {t.status === 'completed' ? '✓ done' : t.status.replace('_',' ')}
                          </span>
                          {canEdit && (
                            <button onClick={() => removeBlocksTask(t.id)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#b45309', padding:0, display:'flex', flexShrink:0 }}>
                              <X style={{ width:10, height:10 }}/>
                            </button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <div style={{ position:'relative' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              value={blocksSearch}
                              onChange={e => { setBlocksSearch(e.target.value); searchBlocksTasks(e.target.value) }}
                              onBlur={() => setTimeout(() => setBlocksResults([]), 150)}
                              placeholder="Search task this blocks…"
                              style={{ flex:1, fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                                background:'var(--surface-subtle)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit', width:'100%' }}
                            />
                          </div>
                          {blocksResults.length > 0 && (
                            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
                              boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:200, maxHeight:140, overflowY:'auto', marginTop:2 }}>
                              {blocksResults.map(t => (
                                <button key={t.id} onClick={() => addBlocksTask(t.id)}
                                  style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'6px 10px',
                                    border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontSize:11,
                                    color:'var(--text-primary)', fontFamily:'inherit' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--surface-subtle)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                                  <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{t.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </FieldRow>
                )}

                {/* Created date */}
                {task.created_at && (
                  <FieldRow label="Created">
                    <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(task.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </FieldRow>
                )}

                {/* Last modified date */}
                {(task as any).updated_at && (
                  <FieldRow label="Last modified">
                    <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date((task as any).updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </FieldRow>
                )}
              </div>

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

            {/* ── Attachments ── */}
            {tab === 'attachments' && (
              <div className="px-5 py-4">
                {/* CA compliance required documents checklist */}
                {caHeaders.length > 0 && (
                  <div className="mb-4 rounded-xl p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#92400e' }}>
                      Required documents ({attachments.length}/{caHeaders.length} uploaded)
                    </p>
                    <div className="flex flex-col gap-1">
                      {caHeaders.map((header, i) => {
                        const uploaded = i < attachments.length
                        return (
                          <div key={header} className="flex items-center gap-2">
                            <span style={{
                              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                              background: uploaded ? '#d1fae5' : '#fef3c7',
                              color: uploaded ? '#065f46' : '#92400e',
                              border: `1px solid ${uploaded ? '#6ee7b7' : '#fde68a'}`,
                            }}>
                              {uploaded ? '✓' : i + 1}
                            </span>
                            <span className="text-xs" style={{ color: uploaded ? '#065f46' : '#78350f' }}>
                              {header}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Mode toggle */}
                <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-light)', width: 'fit-content' }}>
                  <button
                    onClick={() => setAttachMode('file')}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      background: attachMode === 'file' ? 'var(--surface)' : 'transparent',
                      color: attachMode === 'file' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: attachMode === 'file' ? '1px solid var(--border)' : '1px solid transparent',
                    }}>
                    Upload file
                  </button>
                  <button
                    onClick={() => setAttachMode('link')}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                    style={{
                      background: attachMode === 'link' ? 'var(--surface)' : 'transparent',
                      color: attachMode === 'link' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: attachMode === 'link' ? '1px solid var(--border)' : '1px solid transparent',
                    }}>
                    <Link2 className="h-3 w-3" />
                    Paste link
                  </button>
                </div>

                {attachMode === 'file' ? (
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
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, Word, Excel, images, ZIP · Max 20 MB</p>
                      </>
                    }
                    <input ref={fileInputRef} type="file" className="hidden" onChange={uploadFile}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip"/>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 mb-4 space-y-2" style={{ border: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
                    <input
                      type="text"
                      value={driveUrl}
                      onChange={e => setDriveUrl(e.target.value)}
                      placeholder="Paste Google Drive, Notion, or any link… (or type nil)"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                      style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={driveTitle}
                      onChange={e => setDriveTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                      style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={addDriveLink}
                      disabled={uploading || !driveUrl.trim()}
                      className="w-full text-sm font-medium py-2 rounded-lg transition-colors"
                      style={{
                        background: 'var(--brand)',
                        color: '#fff',
                        border: 'none',
                        cursor: uploading || !driveUrl.trim() ? 'not-allowed' : 'pointer',
                        opacity: uploading || !driveUrl.trim() ? 0.6 : 1,
                      }}>
                      {uploading ? 'Adding…' : 'Add link'}
                    </button>
                  </div>
                )}

                {attachments.length === 0
                  ? <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No files attached yet</p>
                  : <div className="space-y-2">
                    {attachments.map(att => {
                      const isNilAtt = att.drive_url === 'nil'
                      const isLink = !isNilAtt && (att.attachment_type === 'link' || att.drive_url)
                      const isImg  = att.mime_type?.startsWith('image/')
                      const icon   = isLink ? null : att.mime_type?.includes('pdf') ? '📄' : isImg ? '🖼️' :
                                     att.mime_type?.includes('sheet') || att.mime_type?.includes('excel') ? '📊' :
                                     att.mime_type?.includes('word') ? '📝' : '📎'
                      const kb = att.file_size ? (att.file_size > 1024*1024
                        ? (att.file_size/1024/1024).toFixed(1) + ' MB'
                        : (att.file_size/1024).toFixed(0) + ' KB') : ''
                      return (
                        <div key={att.id}
                          className="flex items-center gap-3 p-3 rounded-xl group transition-colors"
                          style={{ background: isNilAtt ? 'rgba(217,119,6,0.06)' : 'var(--surface-subtle)',
                            border: `1px solid ${isNilAtt ? 'rgba(217,119,6,0.25)' : 'var(--border-light)'}` }}>
                          {isNilAtt
                            ? <span className="text-2xl flex-shrink-0">🚫</span>
                            : isLink
                              ? <ExternalLink className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                              : <span className="text-2xl flex-shrink-0">{icon}</span>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: isNilAtt ? '#92400e' : 'var(--text-primary)' }}>
                              {isNilAtt ? 'Not available' : att.file_name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {isNilAtt ? 'Marked N/A' : isLink ? 'Link' : kb}{att.uploader?.name ? ` · ${att.uploader.name}` : ''}
                            </p>
                          </div>
                          {isNilAtt
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706',
                                background: 'rgba(217,119,6,0.15)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                                N/A
                              </span>
                            : isLink
                            ? <a href={att.drive_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-medium px-2 py-1 rounded transition-colors flex-shrink-0"
                                style={{ color: 'var(--brand)' }}>
                                Open
                              </a>
                            : <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => viewAttachment(att.storage_path, att.mime_type, att.file_name)}
                                  className="text-xs font-medium px-2 py-1 rounded transition-colors"
                                  style={{ color: 'var(--brand)' }}>
                                  View
                                </button>
                                <button onClick={() => downloadAttachment(att.storage_path, att.file_name)}
                                  title="Download"
                                  className="text-xs px-1 py-1 rounded transition-colors"
                                  style={{ color: 'var(--text-muted)' }}>
                                  ↓
                                </button>
                              </div>
                          }
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
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendComment()
                        }
                      }}
                      placeholder="Write a comment… (Enter to send, Shift+Enter for new line, @ to mention)"
                      rows={2}
                      members={members}
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none transition-all"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    {comment.trim() && (
                      <button onClick={sendComment} disabled={sending}
                        className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'var(--brand)' }}>
                        <Send className="h-3 w-3" />{sending ? 'Sending…' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>
                {loadingComments && !comments.length && (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                )}
                {comments.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {[...comments].reverse().map((cm: any) => (
                      <div key={cm.id} className="flex gap-3">
                        <Avatar name={cm.author?.name ?? '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{cm.author?.name ?? 'Unknown'}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {new Date(cm.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
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
                  !loadingComments && <p className="text-xs text-center py-6 mb-4" style={{ color: 'var(--text-muted)' }}>No comments yet — be the first to add one</p>
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

            {/* ── Activity / Audit trail ── */}
            {tab === 'activity' && (
              <div className="px-5 py-4">
                {activityLoading && (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading history…</p>
                )}
                {!activityLoading && activityLog.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No activity recorded yet.</p>
                )}
                {!activityLoading && activityLog.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activityLog.map((entry: any, i: number) => {
                      const actor = members.find(m => m.id === entry.actor_id)?.name ?? 'Someone'
                      const date  = new Date(entry.created_at)
                      const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={entry.id} style={{ display: 'flex', gap: 12, paddingBottom: 14,
                          position: 'relative' }}>
                          {/* Timeline spine */}
                          {i < activityLog.length - 1 && (
                            <div style={{ position: 'absolute', left: 7, top: 16, bottom: 0, width: 2,
                              background: 'var(--border-light)' }}/>
                          )}
                          {/* Dot */}
                          <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                            background: 'var(--surface-subtle)', border: '2px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }}/>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--text-primary)' }}>
                              <strong>{actor}</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>{entry.action.replace(/_/g, ' ')}</span>
                              {entry.new_value && entry.new_value !== entry.old_value && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {entry.old_value ? ` from "${entry.old_value}"` : ''}{' → '}<em>"{entry.new_value}"</em>
                                </span>
                              )}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                              {dateStr} at {timeStr}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Attachment preview overlay ── */}
      {previewAtt && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setPreviewAtt(null)}
        >
          {/* Toolbar */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {previewAtt.name}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => downloadAttachment(previewAtt.storagePath, previewAtt.name)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e2e8f0', borderRadius: 8, padding: '6px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ↓ Download
              </button>
              <button
                onClick={() => setPreviewAtt(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e2e8f0', borderRadius: 8, padding: '6px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            style={{ maxWidth: '92vw', maxHeight: '80vh', marginTop: 64 }}
            onClick={e => e.stopPropagation()}
          >
            {previewAtt.mimeType?.startsWith('image/') ? (
              <img
                src={previewAtt.url}
                alt={previewAtt.name}
                style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
              />
            ) : previewAtt.mimeType?.includes('pdf') ? (
              <iframe
                src={previewAtt.url}
                title={previewAtt.name}
                style={{ width: '80vw', height: '80vh', border: 'none', borderRadius: 10 }}
              />
            ) : (
              <video
                src={previewAtt.url}
                controls
                autoPlay
                style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 10, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
              />
            )}
          </div>
        </div>
      )}
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