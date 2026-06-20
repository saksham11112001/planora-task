'use client'
import { useState } from 'react'

const TEAL  = '#0d9488'
const DARK  = '#0f172a'
const CARD  = '#1e293b'
const MUTED = '#94a3b8'
const WHITE = '#f1f5f9'

const FEATURES = [
  { icon: '✅', title: 'Task Management', desc: 'Assign tasks, set deadlines, track status — for your whole team. Board view, list view, recurring tasks.' },
  { icon: '📋', title: 'Compliance Tracker', desc: 'GST, TDS, ITR and more — auto-spawned checklists for every client, every deadline.' },
  { icon: '🔁', title: 'Recurring Checklists', desc: 'Set a task once, it auto-creates every month, quarter, or year. Never miss a cycle.' },
  { icon: '🔔', title: 'Smart Reminders', desc: 'Email + in-app reminders sent to your team and clients before deadlines.' },
  { icon: '👥', title: 'Client Portal', desc: 'Each client gets their own portal to view tasks, upload documents, and track status.' },
  { icon: '🧾', title: 'Invoicing', desc: 'Create and send GST-ready invoices to clients directly from the platform.' },
  { icon: '📊', title: 'Reports & Monitor', desc: 'Full-org view of pending, overdue, and completed work across your team.' },
  { icon: '📦', title: 'MSME Tracker', desc: 'This tool is built inside upFloat — unlock full vendor tracking, deadline alerts, and Udyam management.' },
]

export function TryupFloatSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.06)', color: WHITE, border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, padding: '13px 24px', fontSize: 15, fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          textDecoration: 'none',
        }}
      >
        Explore upFloat →
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 200, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Slide-in drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '90vw',
        background: DARK, borderLeft: '1px solid rgba(255,255,255,0.1)',
        zIndex: 201, overflowY: 'auto', padding: '0 0 32px',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: open ? '-24px 0 80px rgba(0,0,0,0.5)' : 'none',
      }}>
        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky', top: 0, background: DARK, zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: WHITE }}>upFloat</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: MUTED, borderRadius: 8, width: 32, height: 32,
              cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Feature list */}
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
            MSME Tracker is one tool inside upFloat. Here's everything else you get:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: CARD, borderRadius: 10, padding: '14px 16px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: WHITE }}>{f.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <a
            href="/login"
            style={{
              display: 'block', marginTop: 24, background: TEAL, color: '#fff',
              borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700,
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            Try upFloat free →
          </a>
          <p style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 10 }}>
            14-day free trial · No credit card needed
          </p>
        </div>
      </div>
    </>
  )
}
