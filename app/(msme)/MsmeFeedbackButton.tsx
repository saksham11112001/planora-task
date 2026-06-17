'use client'
import { useState, useRef } from 'react'

const TEAL   = '#0d9488'
const BORDER = '#e2e8f0'
const MUTED  = '#64748b'
const DARK   = '#0f172a'

export default function MsmeFeedbackButton() {
  const [open, setOpen]       = useState(false)
  const [message, setMessage] = useState('')
  const [files, setFiles]     = useState<File[]>([])
  const [status, setStatus]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const fileRef               = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!message.trim() && files.length === 0) return
    setStatus('sending')
    try {
      const form = new FormData()
      form.append('message', message.trim())
      form.append('url', window.location.href)
      files.forEach(f => form.append('files', f))
      const res = await fetch('/api/report-issue', { method: 'POST', body: form })
      if (!res.ok) throw new Error('failed')
      setStatus('sent')
      setTimeout(() => { setOpen(false); setStatus('idle'); setMessage(''); setFiles([]) }, 1800)
    } catch {
      setStatus('error')
    }
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []))
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#fff8f0', color: '#b45309',
          border: '1px solid #fde68a', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Feedback
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setStatus('idle') } }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)', colorScheme: 'light',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>Send Feedback</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>Report a bug, request a feature, or share any concern</p>
              </div>
              <button onClick={() => { setOpen(false); setStatus('idle') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {status === 'sent' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <p style={{ margin: 0, fontWeight: 600, color: DARK, fontSize: 14 }}>Thanks! We got your feedback.</p>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe the issue or feedback…"
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box', borderRadius: 8,
                    border: `1px solid ${BORDER}`, padding: '10px 12px',
                    fontSize: 13, color: DARK, resize: 'vertical',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />

                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      fontSize: 12, color: MUTED, background: '#f8fafc',
                      border: `1px dashed ${BORDER}`, borderRadius: 6,
                      padding: '6px 10px', cursor: 'pointer', width: '100%', textAlign: 'left',
                    }}
                  >
                    📎 {files.length > 0 ? `${files.length} file(s) attached` : 'Attach screenshot or file (optional)'}
                  </button>
                  <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.zip" style={{ display: 'none' }} onChange={handleFiles} />
                </div>

                {status === 'error' && (
                  <p style={{ fontSize: 12, color: '#dc2626', margin: '8px 0 0' }}>Something went wrong. Please try again.</p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => { setOpen(false); setStatus('idle') }}
                    style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: MUTED }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={status === 'sending' || (!message.trim() && files.length === 0)}
                    style={{
                      flex: 2, padding: '10px', background: TEAL, border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff',
                      opacity: (status === 'sending' || (!message.trim() && files.length === 0)) ? 0.6 : 1,
                    }}
                  >
                    {status === 'sending' ? 'Sending…' : 'Submit Feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
