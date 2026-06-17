'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const ACCENT  = '#0d9488'
const DARK    = '#0f172a'
const MUTED   = '#64748b'
const PAD     = 10   // padding around the spotlight ring

interface Step {
  selector:    string
  title:       string
  description: string
  hint?:       string
  prefer:      'top' | 'bottom' | 'left' | 'right'
}

const STEPS: Step[] = [
  {
    selector:    '[data-tour="msme-header"]',
    title:       'Your MSME dashboard',
    description: 'This is your central hub for tracking Section 43B(h) vendor compliance. Everything you need is here.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-getting-started"]',
    title:       'Three steps to compliance',
    description: 'Add vendors → shoot them a verification email → track their MSME status as they respond. That\'s the full workflow.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-import-btn"]',
    title:       'Bulk import from Excel',
    description: 'Have a spreadsheet of vendor names and emails? Upload it here. The system auto-deduplicates and maps column names automatically.',
    hint:        'Supports .xlsx and .csv',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-add-btn"]',
    title:       'Add a vendor manually',
    description: 'Add a single vendor by name and email. Once added, shoot them an email to collect their MSME certificate in one click.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-upgrade-btn"]',
    title:       'Vendor pack',
    description: 'Free tier covers 5 vendors. Vendors imported beyond your limit appear blurred in the table — upgrade once to unlock them all.',
    hint:        'One-time payment, no subscription',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-schedule-btn"]',
    title:       'Automated follow-up schedule',
    description: 'Configure how many reminder emails to send and how many days apart. The system sends them automatically — you never have to chase manually.',
    prefer:      'bottom',
  },
]

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  onDone: () => void
}

export default function MsmeTour({ onDone }: Props) {
  const [step,    setStep]    = useState(0)
  const [rect,    setRect]    = useState<Rect | null>(null)
  const [vp,      setVp]      = useState({ w: 1280, h: 800 })
  const rafRef = useRef<number | null>(null)

  const measure = useCallback((stepIdx: number) => {
    const s   = STEPS[stepIdx]
    const el  = document.querySelector(s.selector) as HTMLElement | null
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // Wait a tick for scroll to settle, then measure
    setTimeout(() => {
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }, 120)
  }, [])

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight })
    measure(step)

    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      measure(step)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [step, measure])

  function next() {
    // Skip steps whose element doesn't exist in DOM
    let next = step + 1
    while (next < STEPS.length) {
      const el = document.querySelector(STEPS[next].selector)
      if (el) break
      next++
    }
    if (next >= STEPS.length) { onDone(); return }
    setStep(next)
  }

  function prev() {
    let prev = step - 1
    while (prev >= 0) {
      const el = document.querySelector(STEPS[prev].selector)
      if (el) break
      prev--
    }
    if (prev < 0) return
    setStep(prev)
  }

  const s = STEPS[step]

  // Spotlight geometry
  const spotX = rect ? rect.x - PAD : 0
  const spotY = rect ? rect.y - PAD : 0
  const spotW = rect ? rect.w + PAD * 2 : 0
  const spotH = rect ? rect.h + PAD * 2 : 0

  // Tooltip placement — prefer the step's preferred direction, fall back if off-screen
  const TOOLTIP_W = 300
  const TOOLTIP_OFFSET = 16

  function tooltipStyle(): React.CSSProperties {
    if (!rect) {
      // No element — centre the tooltip
      return {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: TOOLTIP_W,
        zIndex: 10001,
      }
    }

    const spaceBelow = vp.h - (spotY + spotH)
    const spaceAbove = spotY
    const spaceRight = vp.w - (spotX + spotW)
    const spaceLeft  = spotX

    let prefer = s.prefer

    // Auto-flip if not enough space
    if (prefer === 'bottom' && spaceBelow < 160 && spaceAbove > 160) prefer = 'top'
    if (prefer === 'top'    && spaceAbove < 160 && spaceBelow > 160) prefer = 'bottom'
    if (prefer === 'right'  && spaceRight < TOOLTIP_W + 20 && spaceLeft > TOOLTIP_W + 20) prefer = 'left'
    if (prefer === 'left'   && spaceLeft  < TOOLTIP_W + 20 && spaceRight > TOOLTIP_W + 20) prefer = 'right'

    const midX = spotX + spotW / 2
    const midY = spotY + spotH / 2

    if (prefer === 'bottom') {
      return {
        position: 'fixed',
        top: spotY + spotH + TOOLTIP_OFFSET,
        left: Math.max(12, Math.min(midX - TOOLTIP_W / 2, vp.w - TOOLTIP_W - 12)),
        width: TOOLTIP_W,
        zIndex: 10001,
      }
    }
    if (prefer === 'top') {
      return {
        position: 'fixed',
        bottom: vp.h - spotY + TOOLTIP_OFFSET,
        left: Math.max(12, Math.min(midX - TOOLTIP_W / 2, vp.w - TOOLTIP_W - 12)),
        width: TOOLTIP_W,
        zIndex: 10001,
      }
    }
    if (prefer === 'right') {
      return {
        position: 'fixed',
        top: Math.max(12, Math.min(midY - 80, vp.h - 180)),
        left: spotX + spotW + TOOLTIP_OFFSET,
        width: TOOLTIP_W,
        zIndex: 10001,
      }
    }
    // left
    return {
      position: 'fixed',
      top: Math.max(12, Math.min(midY - 80, vp.h - 180)),
      right: vp.w - spotX + TOOLTIP_OFFSET,
      width: TOOLTIP_W,
      zIndex: 10001,
    }
  }

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1

  // Count actually-visible steps (elements that exist in DOM)
  const visibleTotal = STEPS.filter((st) => !!document.querySelector(st.selector)).length || STEPS.length

  return (
    <>
      {/* ── Dark overlay — 4 divs around the spotlight ─────────────────────── */}
      {rect ? (
        <>
          {/* Top */}
          <div style={{ position: 'fixed', inset: 0, bottom: `calc(100% - ${spotY}px)`, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          {/* Bottom */}
          <div style={{ position: 'fixed', top: spotY + spotH, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          {/* Left */}
          <div style={{ position: 'fixed', top: spotY, left: 0, width: spotX, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          {/* Right */}
          <div style={{ position: 'fixed', top: spotY, left: spotX + spotW, right: 0, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
          {/* Spotlight ring */}
          <div
            style={{
              position: 'fixed',
              top: spotY - 2, left: spotX - 2,
              width: spotW + 4, height: spotH + 4,
              borderRadius: 10,
              border: `2.5px solid ${ACCENT}`,
              boxShadow: `0 0 0 3px ${ACCENT}30, 0 0 24px ${ACCENT}50`,
              zIndex: 10001,
              pointerEvents: 'none',
            }}
          />
        </>
      ) : (
        // No element — full dark backdrop
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={next} />
      )}

      {/* ── Tooltip ───────────────────────────────────────────────────────────── */}
      <div style={{ ...tooltipStyle(), colorScheme: 'light' }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '18px 20px 16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}>
          {/* Step counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(13,148,136,0.1)', borderRadius: 20, padding: '2px 8px' }}>
              Step {step + 1} of {visibleTotal}
            </span>
            <button
              onClick={onDone}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 16, lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: DARK }}>{s.title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.description}</p>

          {s.hint && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: ACCENT, fontWeight: 600 }}>
              💡 {s.hint}
            </p>
          )}

          {/* Progress bar */}
          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, margin: '14px 0 14px' }}>
            <div style={{ height: 3, background: ACCENT, borderRadius: 2, width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {!isFirst && (
              <button
                onClick={prev}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: MUTED, cursor: 'pointer' }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={isLast ? onDone : next}
              style={{ background: ACCENT, border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              {isLast ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
