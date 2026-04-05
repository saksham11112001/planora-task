'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, FileSpreadsheet, Download, CheckCircle2,
  AlertCircle, Users, FolderOpen, CheckSquare, X,
  ChevronDown, ChevronRight, Loader2, ArrowRight,
  Building2, RefreshCw, ListTodo,
} from 'lucide-react'
import { toast } from '@/store/appStore'

interface ImportResults {
  members:   { created: number; skipped: number; errors: string[] }
  clients:   { created: number; skipped: number; errors: string[] }
  projects:  { created: number; skipped: number; errors: string[] }
  tasks:     { created: number; skipped: number; errors: string[] }
  onetasks:  { created: number; skipped: number; errors: string[] }
  recurring: { created: number; skipped: number; errors: string[] }
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'

export function ImportView() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [state,   setState]   = useState<UploadState>('idle')
  const [file,    setFile]    = useState<File | null>(null)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [errMsg,  setErrMsg]  = useState('')
  const [expanded,setExpanded]= useState<Record<string, boolean>>({})
  const [progress, setProgress] = useState<{step: string; done: boolean; count?: number}[]>([])

  /* ── drag & drop ──────────────────────────────────────────────── */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setState('dragging')
  }, [])
  const onDragLeave = useCallback(() => setState('idle'), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  function pickFile(f: File) {
    if (!f.name.endsWith('.xlsx')) {
      toast.error('Please upload an .xlsx file')
      return
    }
    setFile(f)
    setResults(null)
    setErrMsg('')
    setState('idle')
  }

  /* ── upload ───────────────────────────────────────────────────── */
  async function upload() {
    if (!file) return
    setState('uploading')
    const steps = [
      { step: 'Reading & parsing file…', done: false },
      { step: 'Importing team members…', done: false },
      { step: 'Importing clients…', done: false },
      { step: 'Importing projects…', done: false },
      { step: 'Importing tasks…', done: false },
      { step: 'Importing one-time tasks…', done: false },
      { step: 'Importing recurring tasks…', done: false },
    ]
    setProgress(steps.map(s => ({ ...s })))

    // Animate steps while waiting (~800ms per step)
    let stepIdx = 0
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(prev => prev.map((s, i) => i <= stepIdx ? { ...s, done: true } : s))
        stepIdx++
      }
    }, 800)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      let d: any
      try {
        d = await res.json()
      } catch {
        const text = await res.text().catch(() => '')
        clearInterval(interval)
        setErrMsg(`Server error (${res.status})${text ? ': ' + text.slice(0, 200) : ''}`)
        setState('error')
        setProgress([])
        return
      }
      clearInterval(interval)
      if (!res.ok) {
        setErrMsg(d.error ?? 'Import failed')
        setState('error')
        setProgress([])
      } else {
        // Mark all done with real counts
        setProgress([
          { step: 'File read successfully', done: true },
          { step: `Team members`, done: true, count: d.results?.members?.created },
          { step: `Clients`, done: true, count: d.results?.clients?.created },
          { step: `Projects`, done: true, count: d.results?.projects?.created },
          { step: `Tasks`, done: true, count: d.results?.tasks?.created },
          { step: `One-time tasks`, done: true, count: d.results?.onetasks?.created },
          { step: `Recurring tasks`, done: true, count: d.results?.recurring?.created },
        ])
        setResults(d.results)
        setState('done')
        router.refresh()
      }
    } catch (err: any) {
      clearInterval(interval)
      setErrMsg(err?.message ?? 'Network error — please try again')
      setState('error')
      setProgress([])
    }
  }

  /* ── download template ────────────────────────────────────────── */
  function downloadTemplate() {
    window.open('/api/import/template', '_blank')
  }

  const isDragging = state === 'dragging'
  const isUploading = state === 'uploading'
  const isDone = state === 'done'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: 'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Page header ─────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bulk Import
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Download the template, fill in your data across 6 sheets, then upload it here — members, clients, projects, tasks, one-time tasks and recurring tasks.
          </p>
        </div>

        {/* ── Step 1: Download template ────────────────────────── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)',
          padding: '20px 24px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileSpreadsheet style={{ width: 22, height: 22, color: 'var(--brand)' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Step 1 — Download the template
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Contains three sheets: Team Members, Projects, and Tasks — with sample rows and dropdown hints.
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9, flexShrink: 0,
              background: 'var(--brand)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Download style={{ width: 15, height: 15 }} />
            Download
          </button>
        </div>

        {/* ── Step 2: Upload ───────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 16 }}>
            Step 2 — Upload your filled template
          </p>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !isUploading && fileRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--brand)' : file ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: isUploading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              background: isDragging ? 'var(--brand-light)' : file ? 'var(--brand-light)' : 'var(--surface-subtle)',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])}
            />

            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Loader2 style={{ width: 32, height: 32, color: 'var(--brand)', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', margin: 0 }}>Uploading and importing…</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Please don&apos;t close this page</p>
              </div>
            ) : file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet style={{ width: 36, height: 36, color: 'var(--brand)' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {(file.size / 1024).toFixed(0)} KB — click to change file
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Upload style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                  Drop your .xlsx file here or click to browse
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Max 5 MB</p>
              </div>
            )}
          </div>

          {/* ── Live import progress — shown during upload ── */}
          {isUploading && progress.length > 0 && (
            <div style={{
              marginTop: 16, padding: '18px 20px',
              background: 'var(--surface)',
              border: '1.5px solid var(--brand-border)',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(13,148,136,0.12)',
            }}>
              {/* Header with animated loader */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Loader2 style={{ width: 16, height: 16, color: 'var(--brand)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                  Importing your data — please wait…
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ background: 'var(--border-light)', borderRadius: 99, height: 6, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg, var(--brand), #7c3aed)',
                  width: `${Math.round((progress.filter(p => p.done).length / progress.length) * 100)}%`,
                  transition: 'width 0.5s ease',
                }}/>
              </div>

              {/* Step checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {progress.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Circle indicator */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: p.done ? '#16a34a' : 'var(--border-light)',
                      border: p.done ? 'none' : '2px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}>
                      {p.done
                        ? <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        : <span style={{ width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--text-muted)', display: 'block', opacity: 0.4 }}/>
                      }
                    </div>
                    {/* Step label */}
                    <span style={{
                      fontSize: 13, fontWeight: p.done ? 600 : 400,
                      color: p.done ? 'var(--text-primary)' : 'var(--text-muted)',
                      transition: 'all 0.3s',
                    }}>
                      {p.step}
                    </span>
                    {/* Count badge when done */}
                    {p.done && p.count !== undefined && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                        color: p.count > 0 ? 'var(--brand)' : 'var(--text-muted)',
                        background: p.count > 0 ? 'var(--brand-light)' : 'var(--surface-subtle)',
                        padding: '1px 8px', borderRadius: 99,
                        border: '1px solid var(--border-light)',
                        flexShrink: 0,
                      }}>
                        {p.count > 0 ? `${p.count} imported` : 'none'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
                ⚡ Large files may take 15–30 seconds. Do not close or refresh this page.
              </p>
            </div>
          )}

          {/* Error message */}
          {state === 'error' && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 9,
              background: '#fef2f2', border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle style={{ width: 15, height: 15, color: '#dc2626', flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{errMsg}</p>
            </div>
          )}

          {/* Upload button */}
          {file && !isDone && (
            <button
              onClick={upload}
              disabled={isUploading}
              style={{
                marginTop: 14, width: '100%', padding: '11px',
                borderRadius: 9, border: 'none', cursor: isUploading ? 'default' : 'pointer',
                background: 'var(--brand)', color: '#fff',
                fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: isUploading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {isUploading
                ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Importing…</>
                : <><ArrowRight style={{ width: 16, height: 16 }} /> Start Import</>
              }
            </button>
          )}
        </div>

        {/* ── Results ──────────────────────────────────────────── */}
        {isDone && results && (
          <div style={{
            background: 'var(--surface)', borderRadius: 14,
            border: '1px solid var(--border)', padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: '#16a34a', flexShrink: 0 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Import complete
              </p>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <SummaryCard
                icon={<Users style={{ width: 16, height: 16 }} />}
                label="Members"
                created={results.members.created}
                skipped={results.members.skipped}
                color="var(--brand)"
                bg="var(--brand-light)"
              />
              <SummaryCard
                icon={<Building2 style={{ width: 16, height: 16 }} />}
                label="Clients"
                created={results.clients.created}
                skipped={results.clients.skipped}
                color="#0891b2"
                bg="#ecfeff"
              />
              <SummaryCard
                icon={<FolderOpen style={{ width: 16, height: 16 }} />}
                label="Projects"
                created={results.projects.created}
                skipped={results.projects.skipped}
                color="#16a34a"
                bg="#f0fdf4"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              <SummaryCard
                icon={<CheckSquare style={{ width: 16, height: 16 }} />}
                label="Tasks"
                created={results.tasks.created}
                skipped={results.tasks.skipped}
                color="#7c3aed"
                bg="#f5f3ff"
              />
              <SummaryCard
                icon={<ListTodo style={{ width: 16, height: 16 }} />}
                label="One-Time Tasks"
                created={results.onetasks.created}
                skipped={results.onetasks.skipped}
                color="#0891b2"
                bg="#ecfeff"
              />
              <SummaryCard
                icon={<RefreshCw style={{ width: 16, height: 16 }} />}
                label="Recurring Tasks"
                created={results.recurring.created}
                skipped={results.recurring.skipped}
                color="#ea580c"
                bg="#fff7ed"
              />
            </div>

            {/* Error details (expandable) */}
            {(['members', 'clients', 'projects', 'tasks', 'onetasks', 'recurring'] as const).map(key => {
              const section = results[key]
              if (!section.errors.length) return null
              const isOpen = expanded[key]
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
                    {section.errors.length} {key} row{section.errors.length > 1 ? 's' : ''} had errors
                    {isOpen
                      ? <ChevronDown style={{ width: 13, height: 13, marginLeft: 'auto' }} />
                      : <ChevronRight style={{ width: 13, height: 13, marginLeft: 'auto' }} />
                    }
                  </button>
                  {isOpen && (
                    <div style={{
                      marginTop: 4, padding: '8px 12px', borderRadius: 8,
                      background: '#fff5f5', border: '1px solid #fecaca',
                    }}>
                      {section.errors.map((e, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#b91c1c', margin: '2px 0', fontFamily: 'monospace' }}>
                          {e}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { setFile(null); setResults(null); setState('idle') }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Upload style={{ width: 14, height: 14 }} /> Import another file
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', background: 'var(--brand)', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Go to Dashboard <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* ── What gets imported info ───────────────────────────── */}
        {!isDone && (
          <div style={{
            background: 'var(--surface)', borderRadius: 14,
            border: '1px solid var(--border)', padding: '20px 24px',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              What gets imported
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoRow icon={<Users style={{ width: 16, height: 16, color: 'var(--brand)' }} />}
                label="Team Members" desc="Existing Planora users are added instantly. New emails get an invite." />
              <InfoRow icon={<Building2 style={{ width: 16, height: 16, color: '#0891b2' }} />}
                label="Clients" desc="Created with name, email, phone, company, website, industry and color." />
              <InfoRow icon={<FolderOpen style={{ width: 16, height: 16, color: '#16a34a' }} />}
                label="Projects" desc="Linked to clients by name. Supports color, status, due date, owner and budget." />
              <InfoRow icon={<CheckSquare style={{ width: 16, height: 16, color: '#7c3aed' }} />}
                label="Tasks (Project)" desc="Linked to a project by name. Assignee resolved by email." />
              <InfoRow icon={<ListTodo style={{ width: 16, height: 16, color: '#0891b2' }} />}
                label="One-Time Tasks" desc="Inbox tasks with no project. Supports client, assignee, priority and due date." />
              <InfoRow icon={<RefreshCw style={{ width: 16, height: 16, color: '#ea580c' }} />}
                label="Recurring Tasks" desc="Set frequency (daily/weekly/monthly etc.), assignee and project. Auto-schedules from start date." />
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SummaryCard({ icon, label, created, skipped, color, bg }: {
  icon: React.ReactNode; label: string; created: number; skipped: number; color: string; bg: string
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      border: '1px solid var(--border)', background: bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color, margin: '0 0 2px' }}>{created}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        created{skipped > 0 ? ` · ${skipped} skipped` : ''}
      </p>
    </div>
  )
}

function InfoRow({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{desc}</p>
      </div>
    </div>
  )
}
