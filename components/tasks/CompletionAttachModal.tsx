'use client'
import { useState, useRef } from 'react'
import { Paperclip, X, CheckCircle, Upload, Link as LinkIcon } from 'lucide-react'
import { toast } from '@/store/appStore'

interface Props {
  taskId: string
  taskTitle: string
  onConfirm: () => void   // called after required upload, to actually mark complete
  onCancel: () => void
}

function isValidUrl(str: string) {
  try { new URL(str); return true } catch { return false }
}

export function CompletionAttachModal({ taskId, taskTitle, onConfirm, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [files,     setFiles]     = useState<File[]>([])
  const [linkUrl,   setLinkUrl]   = useState('')
  const [linkName,  setLinkName]  = useState('')
  const [uploading, setUploading] = useState(false)

  const hasFile = files.length > 0
  const hasLink = linkUrl.trim().length > 0
  const canSubmit = hasFile || hasLink

  async function handleConfirm() {
    setUploading(true)
    try {
      if (hasFile) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) toast.error('File upload failed — marking complete anyway')
        else toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached ✓`)
      }

      if (hasLink) {
        const url = linkUrl.trim()
        const res = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drive_url: url,
            file_name: linkName.trim() || url,
            attachment_type: 'link',
          }),
        })
        if (!res.ok) toast.error('Link save failed — marking complete anyway')
        else toast.success('Link attached ✓')
      }
    } catch {
      toast.error('Attachment failed — marking complete anyway')
    } finally {
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
        padding: '24px', width: '100%', maxWidth: 440,
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
              whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 340 }}>
              {taskTitle}
            </p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Attach proof of completion <span style={{ fontWeight: 700, color: '#dc2626' }}>*</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
            (file upload or a link)
          </span>
        </p>

        {/* File upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${hasFile ? 'var(--brand)' : 'var(--border)'}`,
            borderRadius: 10, padding: '14px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 12,
            background: hasFile ? 'var(--brand-light)' : 'var(--surface-subtle)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = hasFile ? 'var(--brand)' : 'var(--border)'}>
          <Upload style={{ width: 18, height: 18, color: 'var(--text-muted)', margin: '0 auto 6px' }}/>
          {hasFile ? (
            <div>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
                  justifyContent: 'center', fontSize: 12, color: 'var(--brand)', marginBottom: 2 }}>
                  <Paperclip style={{ width: 11, height: 11 }}/>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{f.name}</span>
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

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
        </div>

        {/* Link input */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: `1px solid ${hasLink && isValidUrl(linkUrl) ? 'var(--brand)' : hasLink ? '#f87171' : 'var(--border)'}`,
            borderRadius: 8, padding: '8px 12px',
            background: 'var(--surface-subtle)',
          }}>
            <LinkIcon style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}/>
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="Paste Google Drive, Dropbox or any link…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
          </div>
          {hasLink && (
            <input
              type="text"
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              placeholder="Label (optional, e.g. 'Filed GST Return')"
              style={{
                width: '100%', marginTop: 6, fontSize: 12, padding: '6px 10px',
                border: '1px solid var(--border)', borderRadius: 7,
                background: 'var(--surface-subtle)', color: 'var(--text-primary)',
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          )}
          {hasLink && !isValidUrl(linkUrl) && (
            <p style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Please enter a valid URL (starting with https://)</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={uploading || (hasLink && !isValidUrl(linkUrl))}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: canSubmit ? '#16a34a' : 'var(--border)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              cursor: (uploading || (hasLink && !isValidUrl(linkUrl))) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: uploading ? 0.7 : 1, transition: 'all 0.15s',
            }}>
            {uploading ? 'Saving…' : canSubmit ? 'Attach & mark complete' : 'Mark as complete'}
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
