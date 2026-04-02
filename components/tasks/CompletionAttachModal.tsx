'use client'
import { useState, useRef } from 'react'
import { Paperclip, X, CheckCircle, Upload } from 'lucide-react'
import { toast } from '@/store/appStore'

interface Props {
  taskId: string
  taskTitle: string
  onConfirm: () => void   // called after required upload, to actually mark complete
  onCancel: () => void
}

export function CompletionAttachModal({ taskId, taskTitle, onConfirm, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [files,    setFiles]    = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  async function handleConfirm() {
    // If files selected, upload them first; otherwise just mark complete
    if (files.length > 0) {
      setUploading(true)
      try {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) {
          toast.error('File upload failed — marking complete anyway')
        } else {
          toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached ✓`)
        }
      } catch {
        toast.error('Upload failed — marking complete anyway')
      }
      setUploading(false)
    }
    onConfirm()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        padding: '24px', width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CheckCircle style={{ width: 18, height: 18, color: '#16a34a' }}/>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Mark as complete
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 320 }}>
              {taskTitle}
            </p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        {/* Attachment area */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Attach proof of completion <span style={{ fontWeight: 700, color: '#dc2626' }}>*</span>
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${files.length > 0 ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius: 10, padding: '16px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              background: files.length > 0 ? 'var(--brand-light)' : 'var(--surface-subtle)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = files.length > 0 ? 'var(--brand)' : 'var(--border)'}>
            <Upload style={{ width: 20, height: 20, color: 'var(--text-muted)', margin: '0 auto 8px' }}/>
            {files.length > 0 ? (
              <div>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
                    justifyContent: 'center', fontSize: 12, color: 'var(--brand)', marginBottom: 2 }}>
                    <Paperclip style={{ width: 11, height: 11 }}/>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{f.name}</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Click to change files</p>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Click to attach files, images or documents
              </p>
            )}
          </div>
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => setFiles(Array.from(e.target.files ?? []))}/>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} disabled={uploading}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: uploading ? 0.7 : 1, transition: 'all 0.15s',
            }}>
            {uploading ? 'Uploading…' : files.length > 0 ? 'Attach & mark complete' : 'Mark as complete'}
          </button>
          <button onClick={onCancel} style={{
            padding: '10px 16px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
