'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const ACCENT = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const PAD    = 10

type Tab = 'about' | 'kpis' | 'invites' | 'withdrawals'

interface Step {
  selector:    string
  title:       string
  description: string
  hint?:       string
  prefer:      'top' | 'bottom' | 'left' | 'right'
  tab?:        Tab
}

const STEPS: Step[] = [
  {
    selector:    '[data-tour="partner-nav"]',
    title:       'Partner Portal',
    description: 'Welcome to your Partner Portal! From here you can track your referrals, monitor earnings, send invites, and withdraw commissions — all in one place.',
    prefer:      'bottom',
  },
  {
    selector:    '[data-tour="partner-sidebar"]',
    title:       'Sidebar Navigation',
    description: 'Use the sidebar to switch between sections: About (how it works), My KPIs (your numbers), Invites (send referrals), and Withdrawals (get paid).',
    prefer:      'right',
  },
  {
    selector:    '[data-tour="partner-quick-stats"]',
    title:       'Quick Stats',
    description: 'Your live earnings, total sign-ups, and available balance are always visible here at the bottom of the sidebar — no need to leave the current page.',
    prefer:      'right',
  },
  {
    selector:    '[data-tour="partner-referral"]',
    title:       'Your Referral Links',
    description: 'Share these two links — one for MSME Tracker clients, one for other partners. Your referral code is embedded automatically so every sign-up is tracked to you.',
    hint:        'Copy and share on WhatsApp, email, or your website.',
    prefer:      'top',
    tab:         'about',
  },
  {
    selector:    '[data-tour="partner-kpi-grid"]',
    title:       'Your KPIs',
    description: 'Track commission earned, total sign-ups, invites sent, and a breakdown by invite type — all in real time.',
    prefer:      'bottom',
    tab:         'kpis',
  },
  {
    selector:    '[data-tour="partner-tier"]',
    title:       'Partner Tier Progress',
    description: 'You start as a Starter, then unlock Bronze (1 sign-up), Silver (5), and Gold (10). Higher tiers give you priority support and featured placement.',
    prefer:      'top',
    tab:         'kpis',
  },
  {
    selector:    '[data-tour="partner-invite-form"]',
    title:       'Send Invites',
    description: 'Type one or more email addresses, choose whether to invite them to MSME Tracker or the Partner Program, and hit Send. They receive a branded email with your referral link.',
    hint:        'You can send to multiple emails at once.',
    prefer:      'bottom',
    tab:         'invites',
  },
  {
    selector:    '[data-tour="partner-invited-table"]',
    title:       'Referred Users Table',
    description: 'Full transparency — see every invite you sent, whether they signed up, if they purchased a pack, and exactly how much commission you earned per referral.',
    prefer:      'top',
    tab:         'invites',
  },
  {
    selector:    '[data-tour="partner-balance"]',
    title:       'Your Balance',
    description: 'See your total earned commissions, what\'s available to withdraw, and how many withdrawal requests you\'ve made.',
    prefer:      'bottom',
    tab:         'withdrawals',
  },
  {
    selector:    '[data-tour="partner-withdraw-form"]',
    title:       'Withdraw Earnings',
    description: 'When your available balance hits ₹500, submit your bank account details here. Payments are processed within 3–5 business days directly to your account.',
    prefer:      'top',
    tab:         'withdrawals',
  },
]

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  onDone:      () => void
  onTabChange: (tab: Tab) => void
}

export default function PartnerTour({ onDone, onTabChange }: Props) {
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

  const goToStep = useCallback((n: number) => {
    const s = STEPS[n]
    setStep(n)
    setRect(null)
    if (s.tab) {
      onTabChange(s.tab)
      // Wait for tab content to render then measure
      setTimeout(() => measure(n), 380)
    } else {
      setTimeout(() => measure(n), 60)
    }
  }, [measure, onTabChange])

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight })
    const s = STEPS[step]
    if (s.tab) onTabChange(s.tab)
    setTimeout(() => measure(step), s.tab ? 380 : 60)
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); measure(step) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [step, measure, onTabChange])

  function next() {
    let n = step + 1
    while (n < STEPS.length && !willExist(n)) n++
    if (n >= STEPS.length) { onDone(); return }
    goToStep(n)
  }

  function prev() {
    let p = step - 1
    while (p >= 0 && !willExist(p)) p--
    if (p < 0) return
    goToStep(p)
  }

  // A step "will exist" if it has a tab (we can switch to it) or the element is already in DOM
  function willExist(n: number) {
    return !!STEPS[n].tab || !!document.querySelector(STEPS[n].selector)
  }

  const s    = STEPS[step]
  const spotX = rect ? rect.x - PAD : 0
  const spotY = rect ? rect.y - PAD : 0
  const spotW = rect ? rect.w + PAD * 2 : 0
  const spotH = rect ? rect.h + PAD * 2 : 0
  const TOOLTIP_W    = 310
  const TOOLTIP_OFFSET = 16

  function tooltipStyle(): React.CSSProperties {
    const base = { width: TOOLTIP_W, zIndex: 10001 } as React.CSSProperties
    if (!rect) return { ...base, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const TOOLTIP_H  = 220  // conservative max height estimate
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

  const isFirst       = step === 0
  const isLast        = step === STEPS.length - 1
  const visibleTotal  = STEPS.filter((_, i) => willExist(i)).length || STEPS.length
  const visibleIndex  = STEPS.slice(0, step + 1).filter((_, i) => willExist(i)).length

  return (
    <>
      {/* Shadow overlay — 4 panels around spotlight */}
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

      {/* Tooltip */}
      <div style={{ ...tooltipStyle(), colorScheme: 'light' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px 16px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(13,148,136,0.1)', borderRadius: 20, padding: '2px 8px' }}>
              Step {visibleIndex} of {visibleTotal}
            </span>
            <button onClick={onDone} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: DARK }}>{s.title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.description}</p>

          {s.hint && <p style={{ margin: '8px 0 0', fontSize: 11, color: ACCENT, fontWeight: 600 }}>💡 {s.hint}</p>}

          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, margin: '14px 0' }}>
            <div style={{ height: 3, background: ACCENT, borderRadius: 2, width: `${(visibleIndex / visibleTotal) * 100}%`, transition: 'width 0.3s' }} />
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
