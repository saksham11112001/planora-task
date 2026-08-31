'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const ACCENT  = '#0d9488'
const DARK    = '#0f172a'
const MUTED   = '#64748b'
const PAD     = 10   // padding around the spotlight ring

/** Live counts read from MsmeView, used to tell whether a step's task is done. */
export interface TourProgress {
  vendorCount:  number
  emailedCount: number
}

interface Step {
  selector:    string
  title:       string
  description: string
  hint?:       string
  prefer:      'top' | 'bottom' | 'left' | 'right'
  /**
   * The one thing to DO on this step, phrased as an instruction. Its presence
   * is what makes a step a task: gated steps hold "Next" back until the task is
   * done, and offer "Skip this step" instead. Steps without it are context and
   * advance freely, as before.
   */
  action?:     string
  /**
   * Outcome test against live dashboard state. When this passes the step counts
   * as done even if the user got there by another route — pasting a vendor in
   * via import still satisfies "add your first vendor". Steps with an `action`
   * but no `done` are satisfied by clicking the highlighted control.
   */
  done?:       (p: TourProgress) => boolean
}

const STEPS: Step[] = [
  {
    selector:    '[data-tour="msme-header"]',
    title:       'What this page is for',
    description: 'Section 43B(h) means you can only deduct payments to MSME vendors if you paid them on time — and to know who is an MSME, you have to ask them. This page does the asking and keeps the replies as evidence.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-getting-started"]',
    title:       'The whole job is three steps',
    description: 'Add your vendors, email them a declaration form, and watch the replies land here. The rest of this tour walks you through it on your real data — about two minutes.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-add-btn"]',
    title:       'Add your first vendor',
    description: 'Start with one vendor you actually buy from. You need their name and the email address that will receive the declaration form.',
    action:      'Click "+ Add vendor", fill in a name and email, and save.',
    hint:        'Only name and email are required — GSTIN is optional.',
    done:        p => p.vendorCount > 0,
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-import-btn"]',
    title:       'Or bring the whole list in at once',
    description: 'If your vendors are already in a spreadsheet, import it instead of typing them in. Column names are matched automatically and duplicate emails are skipped.',
    hint:        'Optional — skip this if you would rather add them one by one.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-table"]',
    title:       'Now email them the form',
    description: 'Nothing reaches your vendor until you send it. Tick the vendor you just added, then use the "✉ Email selected" button that appears above the list.',
    action:      'Send the declaration email to at least one vendor.',
    hint:        'The first email uses one vendor slot. Replies come back to this table on their own.',
    done:        p => p.emailedCount > 0,
    prefer:      'top',
  },
  {
    selector:    '[data-tour="msme-schedule-btn"]',
    title:       'Chasing happens without you',
    description: 'Vendors who do not reply are reminded automatically on day 7, 14, 21 and 30. Open this to change the timing or the reply-to address.',
    hint:        'You never have to follow up by hand.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="msme-upgrade-btn"]',
    title:       'When you need more than 5',
    description: 'The free tier covers 5 vendors. A slot is used when a vendor is first emailed — not when you add them — so you can load your full list now and decide later.',
    hint:        'Packs run for 12 months from the day you buy.',
    prefer:      'bottom',
  },
]

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  onDone:    () => void
  progress?: TourProgress
  /**
   * True while a dashboard dialog is open. The tour's backdrop sits at
   * z-index 10000, above every modal in the app, so leaving it up meant the
   * Add-vendor form opened BEHIND it: the field could not be typed in, the
   * spotlight stayed on the button that had already been pressed, and the only
   * control still reachable was "Skip this step" — the tour blocking the very
   * task it was asking for. While a dialog is open the tour gets out of the
   * way entirely and returns when the dialog closes.
   */
  paused?:   boolean
}

export default function MsmeTour({ onDone, progress, paused = false }: Props) {
  const [step,    setStep]    = useState(0)
  const [rect,    setRect]    = useState<Rect | null>(null)
  const [vp,      setVp]      = useState({ w: 1280, h: 800 })
  // Whether the CURRENT step's task has been carried out. Reset on every step
  // change; only meaningful for steps that declare an `action`.
  const [didStep, setDidStep] = useState(false)
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
    // Re-measure when a dialog closes as well as when the step changes: adding
    // a vendor grows the table and moves everything below it, so the ring would
    // otherwise come back around whatever now sits at the old coordinates.
    if (paused) return
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
  }, [step, measure, paused])

  const s = STEPS[step]
  /** A step is a task when it says what to do. Everything else is context. */
  const isTask  = !!s.action
  /** Satisfied either by the outcome check against live data, or — for tasks
   *  with no measurable outcome — by the user clicking the highlighted control. */
  const taskDone = !isTask || (s.done ? s.done(progress ?? { vendorCount: 0, emailedCount: 0 }) : didStep)

  // Clear the click flag whenever the step changes, so a click on step 3 can
  // never count as having done step 5.
  useEffect(() => { setDidStep(false) }, [step])

  // Count a click on the spotlighted control as having done the task. Capture
  // phase, because the control's own handler may unmount it (opening a modal)
  // before a bubbling listener would ever run.
  useEffect(() => {
    if (!isTask) return
    function onClick(e: MouseEvent) {
      const el = document.querySelector(s.selector)
      if (el && e.target instanceof Node && el.contains(e.target)) setDidStep(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [isTask, s.selector])

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

  /**
   * Clicking the dark area used to advance the tour. On a task step that is the
   * opposite of what we want — a stray click would carry the user past the very
   * thing they were asked to do, which is how people ended up at the end of the
   * tour without having added a vendor. Context steps keep the old behaviour.
   */
  function backdropAdvance() {
    if (isTask && !taskDone) return
    next()
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

  // Step aside while a dialog is open. Placed after every hook so hook order is
  // identical on both branches; the component keeps its step, its click
  // listener and its progress, and simply renders nothing until the dialog is
  // dismissed — at which point the task will usually already be satisfied.
  if (paused) return null

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
          <div style={{ position: 'fixed', inset: 0, bottom: `calc(100% - ${spotY}px)`, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={backdropAdvance} />
          {/* Bottom */}
          <div style={{ position: 'fixed', top: spotY + spotH, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={backdropAdvance} />
          {/* Left */}
          <div style={{ position: 'fixed', top: spotY, left: 0, width: spotX, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={backdropAdvance} />
          {/* Right */}
          <div style={{ position: 'fixed', top: spotY, left: spotX + spotW, right: 0, height: spotH, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={backdropAdvance} />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10000 }} onClick={backdropAdvance} />
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

          {/* The instruction, and whether it has been carried out. This is the
              part that was missing: the tour described the screen but never
              said what to do, so people finished it none the wiser. */}
          {s.action && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              margin: '12px 0 0', padding: '10px 12px', borderRadius: 8,
              background: taskDone ? 'rgba(22,163,74,0.08)' : 'rgba(13,148,136,0.08)',
              border: `1px solid ${taskDone ? 'rgba(22,163,74,0.35)' : 'rgba(13,148,136,0.35)'}`,
            }}>
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>{taskDone ? '✅' : '👉'}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: taskDone ? '#15803d' : DARK }}>
                {taskDone ? 'Done — you can carry on.' : s.action}
              </span>
            </div>
          )}

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
            {/* An unfinished task offers a way out rather than a dead end —
                nobody should be trapped in a tour. It is a quiet text link, so
                doing the task stays the obvious path. */}
            {isTask && !taskDone && (
              <button
                onClick={next}
                style={{ background: 'none', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, color: MUTED, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Skip this step
              </button>
            )}
            <button
              onClick={isLast ? onDone : next}
              disabled={isTask && !taskDone}
              title={isTask && !taskDone ? s.action : undefined}
              style={{
                background: isTask && !taskDone ? '#cbd5e1' : ACCENT,
                border: 'none', borderRadius: 7, padding: '7px 18px',
                fontSize: 12, fontWeight: 700, color: '#fff',
                cursor: isTask && !taskDone ? 'not-allowed' : 'pointer',
              }}
            >
              {isLast ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
