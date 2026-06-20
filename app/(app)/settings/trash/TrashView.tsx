'use client'
import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, Clock, AlertTriangle, Lock, Zap } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/store/appStore'

interface DeletedTask {
  id: string; title: string; status: string; priority: string
  due_date: string|null; deleted_at: string; project_id: string|null
  projects: { name: string }|null
}

interface Props { canManage: boolean; isPaid: boolean; planTier: string }

const PRIORITY_COLOR: Record<string,string> = {
  urgent:'#dc2626', high:'#ea580c', medium:'#ca8a04', low:'#16a34a', none:'#94a3b8'
}

export function TrashView({ canManage, isPaid, planTier }: Props) {
  const [tasks,         setTasks]         = useState<DeletedTask[]>([])
  const [loading,       setLoading]       = useState(true)
  const [restoring,     setRestoring]     = useState<string|null>(null)
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [bulkRestoring, setBulkRestoring] = useState(false)

  useEffect(() => {
    fetch('/api/trash')
      .then(r => r.json())
      .then(d => setTasks(d.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function restore(taskId: string) {
    if (!isPaid) return
    setRestoring(taskId)
    const res = await fetch('/api/trash', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    })
    if (res.ok) {
      setTasks(p => p.filter(t => t.id !== taskId))
      setSelected(p => { const n = new Set(p); n.delete(taskId); return n })
      toast.success('Task restored ✓')
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to restore')
    }
    setRestoring(null)
  }

  async function bulkRestore() {
    if (!isPaid || selected.size === 0) return
    setBulkRestoring(true)
    const ids = Array.from(selected)
    let ok = 0, fail = 0
    for (const id of ids) {
      const res = await fetch('/api/trash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id }),
      })
      if (res.ok) { ok++; setTasks(p => p.filter(t => t.id !== id)) }
      else fail++
    }
    setSelected(new Set())
    setBulkRestoring(false)
    if (ok > 0) toast.success(`${ok} task${ok > 1 ? 's' : ''} restored ✓`)
    if (fail > 0) toast.error(`${fail} task${fail > 1 ? 's' : ''} failed`)
  }

  function toggleSelect(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    if (selected.size === tasks.length) setSelected(new Set())
    else setSelected(new Set(tasks.map(t => t.id)))
  }

  const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  const daysLeft = (d: string) => 30 - daysAgo(d)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <Trash2 style={{ width:18, height:18, color:'#dc2626' }}/>
        <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
          Trash & Recovery
        </h1>
        {!isPaid && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 10px',
            borderRadius:99, background:'#fef2f2', border:'1px solid #fecaca',
            fontSize:11, fontWeight:700, color:'#dc2626' }}>
            <Lock style={{ width:9, height:9 }}/> Paid feature
          </span>
        )}
      </div>

      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
        Deleted tasks are kept for 30 days. {isPaid ? 'Select tasks below to restore them.' : 'Upgrade to restore deleted tasks.'}
      </p>

      {/* Paid upsell banner */}
      {!isPaid && (
        <div style={{ marginBottom:20, padding:'18px 20px', borderRadius:12,
          background:'linear-gradient(135deg,#faf5ff,#f0fdfa)',
          border:'1px solid #ddd6fe' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'#7c3aed',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Zap style={{ width:16, height:16, color:'#fff' }}/>
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:'#4c1d95', margin:0 }}>
                Restore is a paid feature
              </p>
              <p style={{ fontSize:12, color:'#6d28d9', margin:0 }}>
                Available on Starter, Pro, and Business plans
              </p>
            </div>
          </div>
          <p style={{ fontSize:13, color:'#5b21b6', marginBottom:14, lineHeight:1.6 }}>
            You can see deleted tasks below, but restoring them requires an active paid plan.
            Upgrade now — plans start at ₹999/month.
          </p>
          <Link href="/settings/billing" style={{ display:'inline-flex', alignItems:'center', gap:6,
            padding:'8px 18px', borderRadius:8, background:'#7c3aed', color:'#fff',
            textDecoration:'none', fontSize:13, fontWeight:600 }}>
            <Zap style={{ width:13, height:13 }}/> Upgrade to restore tasks
          </Link>
        </div>
      )}

      {/* Warning */}
      <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb',
        border:'1px solid #fde68a', display:'flex', gap:8, marginBottom:20 }}>
        <AlertTriangle style={{ width:14, height:14, color:'#ca8a04', flexShrink:0, marginTop:1 }}/>
        <p style={{ fontSize:12, color:'#92400e', margin:0 }}>
          Tasks are <strong>permanently deleted after 30 days</strong>. Projects, clients, and time logs
          have no recovery window — export regularly from Reports for long-term backups.
        </p>
      </div>

      {loading ? (
        <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
          Loading deleted tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ padding:'48px 24px', textAlign:'center',
          background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)' }}>
          <Trash2 style={{ width:36, height:36, color:'var(--border)', margin:'0 auto 12px' }}/>
          <p style={{ fontSize:14, fontWeight:500, color:'var(--text-primary)', marginBottom:6 }}>
            Trash is empty
          </p>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>
            No tasks deleted in the last 30 days
          </p>
        </div>
      ) : (
        <>
          {/* Bulk action bar — shown when items selected */}
          {isPaid && canManage && selected.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 16px', borderRadius:10, background:'var(--brand-light)',
              border:'1px solid var(--brand-border)', marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--brand)' }}>
                {selected.size} task{selected.size > 1 ? 's' : ''} selected
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setSelected(new Set())}
                  style={{ padding:'5px 12px', borderRadius:7, border:'1px solid var(--brand-border)',
                    background:'transparent', color:'var(--brand)', fontSize:12, fontWeight:500,
                    cursor:'pointer', fontFamily:'inherit' }}>
                  Clear
                </button>
                <button onClick={bulkRestore} disabled={bulkRestoring}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px',
                    borderRadius:7, border:'none', background:'var(--brand)', color:'#fff',
                    fontSize:12, fontWeight:600, cursor: bulkRestoring ? 'not-allowed' : 'pointer',
                    opacity: bulkRestoring ? 0.7 : 1, fontFamily:'inherit' }}>
                  <RotateCcw style={{ width:11, height:11 }}/>
                  {bulkRestoring ? 'Restoring…' : `Restore ${selected.size}`}
                </button>
              </div>
            </div>
          )}

          <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            {/* Header */}
            <div style={{ display:'grid',
              gridTemplateColumns: isPaid && canManage ? '28px 1fr 110px 100px' : '1fr 110px 100px',
              padding:'8px 16px', background:'var(--surface-subtle)',
              borderBottom:'1px solid var(--border)',
              fontSize:11, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.05em', alignItems:'center' }}>
              {isPaid && canManage && (
                <input type="checkbox"
                  checked={tasks.length > 0 && selected.size === tasks.length}
                  onChange={toggleAll}
                  style={{ width:14, height:14, cursor:'pointer', accentColor:'var(--brand)' }}/>
              )}
              <div>Task</div>
              <div>Deleted</div>
              <div style={{ textAlign:'right' }}>Action</div>
            </div>

            {tasks.map((t, i) => {
              const ago    = daysAgo(t.deleted_at)
              const left   = daysLeft(t.deleted_at)
              const urgent = left <= 5
              const isSel  = selected.has(t.id)
              return (
                <div key={t.id} style={{ display:'grid',
                  gridTemplateColumns: isPaid && canManage ? '28px 1fr 110px 100px' : '1fr 110px 100px',
                  alignItems:'center', padding:'12px 16px',
                  borderBottom: i < tasks.length-1 ? '1px solid var(--border-light)' : 'none',
                  background: isSel ? 'var(--brand-light)' : 'var(--surface)',
                  opacity: isPaid ? 1 : 0.75,
                  transition:'background 0.1s' }}>

                  {/* Checkbox */}
                  {isPaid && canManage && (
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(t.id)}
                      style={{ width:14, height:14, cursor:'pointer', accentColor:'var(--brand)' }}/>
                  )}

                  {/* Task info */}
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:500, color:'var(--text-muted)',
                      textDecoration:'line-through', overflow:'hidden',
                      whiteSpace:'nowrap', textOverflow:'ellipsis', marginBottom:3 }}>
                      {t.title}
                    </p>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {t.projects && (
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                          📁 {t.projects.name}
                        </span>
                      )}
                      <span style={{ fontSize:11, padding:'1px 6px', borderRadius:4,
                        background: (PRIORITY_COLOR[t.priority] ?? '#94a3b8') + '18',
                        color: PRIORITY_COLOR[t.priority] ?? '#94a3b8',
                        fontWeight:500 }}>
                        {t.priority}
                      </span>
                    </div>
                  </div>

                  {/* Deleted time */}
                  <div>
                    <p style={{ fontSize:12, color:'var(--text-secondary)', display:'flex',
                      alignItems:'center', gap:4 }}>
                      <Clock style={{ width:10, height:10 }}/>
                      {ago === 0 ? 'Today' : `${ago}d ago`}
                    </p>
                    <p style={{ fontSize:11, color: urgent ? '#dc2626' : 'var(--text-muted)',
                      fontWeight: urgent ? 600 : 400, marginTop:2 }}>
                      {urgent ? `⚠️ ${left}d left` : `Expires in ${left}d`}
                    </p>
                  </div>

                  {/* Restore button */}
                  <div style={{ textAlign:'right' }}>
                    {isPaid && canManage ? (
                      <button onClick={() => restore(t.id)} disabled={restoring === t.id || bulkRestoring}
                        style={{ display:'inline-flex', alignItems:'center', gap:5,
                          padding:'6px 12px', borderRadius:7,
                          border:'1px solid var(--brand-border)',
                          background:'var(--brand-light)', color:'var(--brand)',
                          fontSize:12, fontWeight:600, cursor:'pointer',
                          fontFamily:'inherit', opacity: (restoring === t.id || bulkRestoring) ? 0.6 : 1,
                          transition:'all 0.15s' }}
                        onMouseEnter={e=>{if (!bulkRestoring && restoring!==t.id){(e.currentTarget as any).style.background='var(--brand)';(e.currentTarget as any).style.color='#fff'}}}
                        onMouseLeave={e=>{(e.currentTarget as any).style.background='var(--brand-light)';(e.currentTarget as any).style.color='var(--brand)'}}>
                        <RotateCcw style={{ width:11, height:11 }}/>
                        {restoring === t.id ? 'Restoring…' : 'Restore'}
                      </button>
                    ) : (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:4,
                        padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)',
                        background:'var(--surface-subtle)', color:'var(--text-muted)', fontSize:11 }}>
                        <Lock style={{ width:10, height:10 }}/> Upgrade
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Bottom note */}
      <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:14, textAlign:'center' }}>
        {tasks.length} deleted task{tasks.length !== 1 ? 's' : ''} · Auto-purge after 30 days
        {isPaid ? '' : ' · Restore available on paid plans'}
      </p>
    </div>
  )
}
