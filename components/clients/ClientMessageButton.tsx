'use client'
import { useState } from 'react'

interface Props {
  clientName: string
  clientPhone?: string | null
  clientEmail?: string | null
  taskTitle?: string
  dueDate?: string
}

interface Template {
  icon: string
  label: string
  build: (p: { clientName: string; taskTitle: string; dueDate: string }) => string
}

const TEMPLATES: Template[] = [
  {
    icon: '📥',
    label: 'Document Request',
    build: ({ clientName, taskTitle, dueDate }) =>
      `Dear ${clientName}, kindly share documents for ${taskTitle} by ${dueDate}. Please revert at your earliest. Thanks, [Your Firm Name]`,
  },
  {
    icon: '✅',
    label: 'Filing Confirmed',
    build: ({ clientName, taskTitle }) =>
      `Dear ${clientName}, your ${taskTitle} has been filed successfully. Acknowledgement will be shared shortly. Thanks, [Your Firm Name]`,
  },
  {
    icon: '💰',
    label: 'Advance Tax Reminder',
    build: ({ clientName, dueDate }) =>
      `Dear ${clientName}, your advance tax installment is due on ${dueDate}. Please deposit the amount at the earliest. Thanks, [Your Firm Name]`,
  },
  {
    icon: '⚠️',
    label: 'Overdue Alert',
    build: ({ clientName, taskTitle }) =>
      `Dear ${clientName}, ${taskTitle} is overdue. Please share the required documents immediately to avoid penalty. Thanks, [Your Firm Name]`,
  },
  {
    icon: '📄',
    label: 'Invoice Sent',
    build: ({ clientName }) =>
      `Dear ${clientName}, please find your invoice attached. Kindly arrange payment at your earliest convenience. Thanks, [Your Firm Name]`,
  },
]

export function ClientMessageButton({ clientName, clientPhone, clientEmail, taskTitle, dueDate }: Props) {
  const [open, setOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const vars = {
    clientName: clientName || 'Client',
    taskTitle: taskTitle || 'this task',
    dueDate: dueDate
      ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'the due date',
  }

  function copyMessage(msg: string, idx: number) {
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
          color: 'var(--fg-muted, #64748b)', cursor: 'pointer', transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--fg, #0f172a)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--fg-muted, #64748b)'
        }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Send Message
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          {/* Modal panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface, #fff)', borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              width: '100%', maxWidth: 520,
              maxHeight: '85vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
            }}>
            {/* Modal header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg, #0f172a)' }}>
                  Send Message
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted, #64748b)' }}>
                  to {clientName}
                  {clientPhone && <span style={{ marginLeft: 6, opacity: 0.6 }}>· {clientPhone}</span>}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--fg-muted, #64748b)', padding: 4,
                  display: 'flex', alignItems: 'center', borderRadius: 6,
                  fontSize: 18, lineHeight: 1,
                }}>
                ×
              </button>
            </div>

            {/* Template list */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map((tpl, idx) => {
                const message = tpl.build(vars)
                const waUrl = clientPhone
                  ? `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
                  : null

                return (
                  <div key={idx} style={{
                    border: '1px solid rgba(0,0,0,0.09)', borderRadius: 10,
                    padding: '12px 14px', background: 'rgba(0,0,0,0.015)',
                  }}>
                    {/* Template label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{tpl.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg, #0f172a)' }}>
                        {tpl.label}
                      </span>
                    </div>

                    {/* Message preview */}
                    <p style={{
                      margin: '0 0 10px', fontSize: 12, lineHeight: 1.55,
                      color: 'var(--fg-muted, #64748b)',
                      background: 'rgba(0,0,0,0.03)', borderRadius: 7,
                      padding: '8px 10px',
                    }}>
                      {message}
                    </p>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* WhatsApp button */}
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                            textDecoration: 'none',
                            background: 'rgba(37,211,102,0.12)', color: '#22c55e',
                            border: '1px solid rgba(37,211,102,0.25)',
                            transition: 'all 0.12s',
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L0 24l6.337-1.512A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.003-1.368l-.36-.213-3.729.892.924-3.627-.234-.373A9.773 9.773 0 0 1 2.182 12C2.182 6.577 6.577 2.182 12 2.182S21.818 6.577 21.818 12 17.423 21.818 12 21.818z"/>
                          </svg>
                          WhatsApp
                        </a>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                          background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(0,0,0,0.08)', cursor: 'not-allowed',
                        }}>
                          No phone
                        </span>
                      )}

                      {/* Copy button */}
                      <button
                        onClick={() => copyMessage(message, idx)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: copiedIdx === idx ? 'rgba(13,148,136,0.1)' : 'transparent',
                          color: copiedIdx === idx ? '#0d9488' : 'var(--fg-muted, #64748b)',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}>
                        {copiedIdx === idx ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
