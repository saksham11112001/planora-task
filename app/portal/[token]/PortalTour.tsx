'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const ACCENT = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const PAD    = 10

interface Step {
  selector:    string
  title:       string
  description: string
  hint?:       string
  prefer:      'top' | 'bottom' | 'left' | 'right'
}

const STEPS: Step[] = [
  {
    selector:    '[data-tour="portal-header"]',
    title:       'Your Client Portal',
    description: 'This is your dedicated compliance portal. Your CA firm shares this link with you so you can upload documents and track filings — no login needed.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="portal-deadlines"]',
    title:       'Upcoming Filing Deadlines',
    description: 'This section shows all your compliance tasks that are coming up. Each card shows the filing deadline and what documents your CA needs from you.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="portal-task-card"]',
    title:       'Upload Documents Here',
    description: 'Each task has a checklist of required documents. Click "+ Upload" next to each item to attach the file. Your CA is notified instantly when you upload.',
    hint:        'Accepted formats: PDF, JPG, PNG (max 5 MB)',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="portal-permanent"]',
    title:       'Permanent Documents',
    description: 'Documents like PAN card, Aadhaar, or registration certificates only need to be uploaded once. They stay here permanently for your CA to access anytime.',
    prefer:      'top',
  },
  {
    selector:    '[data-tour="portal-history"]',
    title:       'Filing History',
    description: 'Once a task is completed by your CA, it appears here. This is your audit trail of everything filed on your behalf in the last 6 months.',
    prefer:      'top',
  },
  {
    selector:    '[data-tour="portal-tour-btn"]',
    title:       'Replay this tour anytime',
    description: 'Click "? Take a tour" whenever you need a refresher. Share this portal link with anyone in your team who needs to upload documents.',
    prefer:      'bottom',
  },
]

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  onDone: () => void
}

export default function PortalTour({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [vp,   setVp]   = useState({ w: 1280, h: 800 })
  const rafRef = useRef<number | null>(null)

  // Lock body scroll while tour is active
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const measure = useCallback((stepIdx: number) => {
    const s  = STEPS[stepIdx]
    const el = document.querySelector(s.selector) as HTMLElement | null
    if (!el) { setRect(null); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }, 180)
  }, [])

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight })
    setRect(null)
    setTimeout(() => measure(step), 60)
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); measure(step) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [step, measure])

  function next() {
    let n = step + 1
    while (n < STEPS.length && !document.querySelector(STEPS[n].selector)) n++
    if (n >= STEPS.length) { onDone(); return }
    setStep(n)
  }

  function prev() {
    let p = step - 1
    while (p >= 0 && !document.querySelector(STEPS[p].selector)) p--
    if (p < 0) return
    setStep(p)
  }

  const s    = STEPS[step]
  const spotX = rect ? rect.x - PAD : 0
  const spotY = rect ? rect.y - PAD : 0
  const spotW = rect ? rect.w + PAD * 2 : 0
  const spotH = rect ? rect.h + PAD * 2 : 0
  const TOOLTIP_W = 300
  const TOOLTIP_OFFSET = 16

  function tooltipStyle(): React.CSSProperties {
    const base = { width: TOOLTIP_W, zIndex: 10001 } as React.CSSProperties
    if (!rect) return { ...base, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const TOOLTIP_H  = 220
    const spaceBelow = vp.h - (spotY + spotH)
    const spaceAbove = spotY
    const spaceRight = vp.w - (spotX + spotW)
    const midX = spotX + spotW / 2
    const midY = spotY + spotH / 2

    let prefer = s.prefer
    if (prefer === 'bottom' && spaceBelow < TOOLTIP_H + 20 && spaceAbove > TOOLTIP_H + 20) prefer = 'top'
    if (prefer === 'top'    && spaceAbove < TOOLTIP_H + 20 && spaceBelow > TOOLTIP_H + 20) prefer = 'bottom'
    if (prefer === 'right'  && spaceRight  < TOOLTIP_W + 20) prefer = 'left'

    const clampLeft = (x: number) => Math.max(12, Math.min(x, vp.w - TOOLTIP_W - 12))
    const clampTop  = (y: number) => Math.max(12, Math.min(y, vp.h - TOOLTIP_H - 12))

    if (prefer === 'bottom') return { ...base, position: 'fixed', top: clampTop(spotY + spotH + TOOLTIP_OFFSET), left: clampLeft(midX - TOOLTIP_W / 2) }
    if (prefer === 'top')    return { ...base, position: 'fixed', top: clampTop(spotY - TOOLTIP_H - TOOLTIP_OFFSET), left: clampLeft(midX - TOOLTIP_W / 2) }
    if (prefer === 'right')  return { ...base, position: 'fixed', top: clampTop(midY - TOOLTIP_H / 2), left: Math.min(spotX + spotW + TOOLTIP_OFFSET, vp.w - TOOLTIP_W - 12) }
    return { ...base, position: 'fixed', top: clampTop(midY - TOOLTIP_H / 2), left: clampLeft(spotX - TOOLTIP_W - TOOLTIP_OFFSET) }
  }

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const visibleTotal = STEPS.filter(st => !!document.querySelector(st.selector)).length || STEPS.length

  return (
    <>
      {/* ── Shadow overlay (4 panels around spotlight) ─────────────────────── */}
      {rect ? (
        <>
          <div style={{ position: 'fixed', inset: 0, bottom: `calc(100% - ${spotY}px)`, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          <div style={{ position: 'fixed', top: spotY + spotH, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          <div style={{ position: 'fixed', top: spotY, left: 0, width: spotX, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          <div style={{ position: 'fixed', top: spotY, left: spotX + spotW, right: 0, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          {/* Teal spotlight ring */}
          <div style={{ position: 'fixed', top: spotY - 2, left: spotX - 2, width: spotW + 4, height: spotH + 4, borderRadius: 10, border: `2.5px solid ${ACCENT}`, boxShadow: `0 0 0 3px ${ACCENT}30, 0 0 24px ${ACCENT}50`, zIndex: 10001, pointerEvents: 'none' }} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
      )}

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      <div style={{ ...tooltipStyle(), colorScheme: 'light' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px 16px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(13,148,136,0.1)', borderRadius: 20, padding: '2px 8px' }}>
              Step {step + 1} of {visibleTotal}
            </span>
            <button onClick={onDone} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: DARK }}>{s.title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.description}</p>

          {s.hint && <p style={{ margin: '8px 0 0', fontSize: 11, color: ACCENT, fontWeight: 600 }}>💡 {s.hint}</p>}

          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, margin: '14px 0 14px' }}>
            <div style={{ height: 3, background: ACCENT, borderRadius: 2, width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {!isFirst && (
              <button onClick={prev} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>
                ← Back
              </button>
            )}
            <button onClick={onDone} style={{ background: 'none', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
              Skip
            </button>
            <button onClick={isLast ? onDone : next} style={{ background: ACCENT, border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              {isLast ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
