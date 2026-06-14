'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/* ─── Tour steps ─────────────────────────────────────────────────── */
type Step =
  | { type: 'modal' }
  | { type: 'spotlight'; selector: string; route?: string; title: string; body: string; placement: 'right' | 'left' | 'bottom' | 'top'; action: 'click_target' | 'next_button'; cta?: string }

const STEPS: Step[] = [
  { type: 'modal' },                                                   // 0 – welcome modal
  {
    type: 'spotlight', selector: 'a[href="/compliance"]',
    route: '/dashboard',
    title: 'CA Compliance', body: 'Never miss a GST, ITR or TDS deadline. Click Compliance to explore.',
    placement: 'right', action: 'click_target',
  },                                                                   // 1 – sidebar compliance
  {
    type: 'spotlight', selector: '[data-tour="compliance-task-row"]',
    route: '/compliance',
    title: 'Your compliance tasks', body: 'Each task shows the client, due date and filing status. Click any row to open it.',
    placement: 'right', action: 'click_target',
  },                                                                   // 2 – compliance task row
  {
    type: 'spotlight', selector: 'a[href="/clients"]',
    title: 'Manage clients', body: 'All your clients live here. Click Clients to continue.',
    placement: 'right', action: 'click_target',
  },                                                                   // 3 – sidebar clients
  {
    type: 'spotlight', selector: 'a[href="/clients/new"]',
    route: '/clients',
    title: 'Add your first client', body: 'Click "+ New client" and add a client — it only takes 30 seconds.',
    placement: 'bottom', action: 'click_target',
  },                                                                   // 4 – add client button
  {
    type: 'spotlight', selector: 'a[href="/tasks"]',
    title: 'Track your tasks', body: 'See everything assigned to you, across all clients, in one board.',
    placement: 'right', action: 'click_target',
  },                                                                   // 5 – sidebar tasks
  {
    type: 'spotlight', selector: 'a[href="/team"]',
    title: 'Invite your team', body: "Add your staff so you can assign work and track who’s doing what.",
    placement: 'right', action: 'next_button', cta: 'Finish tour',
  },                                                                   // 6 – sidebar team
]

/* ─── Confetti burst ─────────────────────────────────────────────── */
function Confetti() {
  const colors = ['#0d9488','#0891b2','#7c3aed','#ca8a04','#ef4444','#10b981']
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    size: 6 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 120,
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-12px', left: `${p.left}%`,
          width: p.size, height: p.size, borderRadius: 2,
          background: p.color, opacity: 0,
          animation: `confettiFall 1.4s ${p.delay}s ease-in forwards`,
          '--drift': `${p.drift}px`,
        } as React.CSSProperties}/>
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { opacity:1; transform: translateY(0) translateX(0) rotate(0deg); }
          100% { opacity:0; transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── Spotlight overlay: 4 dark panels around the hole ──────────── */
interface SpotlightProps {
  rect: DOMRect
  padding?: number
}
function SpotlightOverlay({ rect, padding = 8 }: SpotlightProps) {
  const top    = rect.top    - padding
  const left   = rect.left   - padding
  const right  = rect.right  + padding
  const bottom = rect.bottom + padding
  const dark   = 'rgba(0,0,0,0.65)'
  return (
    <>
      {/* top */}
      <div style={{ position:'fixed', inset:0, top:0, left:0, right:0, height: Math.max(0, top), background: dark, zIndex: 9000 }}/>
      {/* bottom */}
      <div style={{ position:'fixed', left:0, right:0, top: Math.max(0, bottom), bottom:0, background: dark, zIndex: 9000 }}/>
      {/* left */}
      <div style={{ position:'fixed', top: Math.max(0, top), left:0, width: Math.max(0, left), height: Math.max(0, bottom - top), background: dark, zIndex: 9000 }}/>
      {/* right */}
      <div style={{ position:'fixed', top: Math.max(0, top), left: Math.max(0, right), right:0, height: Math.max(0, bottom - top), background: dark, zIndex: 9000 }}/>
      {/* ring */}
      <div style={{
        position: 'fixed', top: top, left: left,
        width: rect.width + padding * 2, height: rect.height + padding * 2,
        borderRadius: 8, boxShadow: '0 0 0 2px rgba(13,148,136,0.8)',
        zIndex: 9001, pointerEvents: 'none',
      }}/>
    </>
  )
}

/* ─── Tooltip ────────────────────────────────────────────────────── */
interface TooltipProps {
  rect: DOMRect
  placement: 'right' | 'left' | 'bottom' | 'top'
  title: string
  body: string
  step: number
  total: number
  action: 'click_target' | 'next_button'
  cta?: string
  onNext: () => void
  onSkip: () => void
}
function Tooltip({ rect, placement, title, body, step, total, action, cta, onNext, onSkip }: TooltipProps) {
  const GAP = 16
  const W = 260

  let style: React.CSSProperties = { position: 'fixed', zIndex: 9010, width: W }
  const midY = rect.top + rect.height / 2
  const midX = rect.left + rect.width / 2

  if (placement === 'right') {
    style.left = rect.right + GAP
    style.top  = midY - 60
  } else if (placement === 'left') {
    style.left = rect.left - W - GAP
    style.top  = midY - 60
  } else if (placement === 'bottom') {
    style.left = Math.max(8, midX - W / 2)
    style.top  = rect.bottom + GAP
  } else {
    style.left = Math.max(8, midX - W / 2)
    style.top  = rect.top - 140 - GAP
  }

  // Clamp to viewport
  if (typeof style.left === 'number' && style.left + W > window.innerWidth - 8) {
    style.left = window.innerWidth - W - 8
  }

  return (
    <div style={{
      ...style,
      background: 'var(--surface, #1e293b)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '16px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      color: 'var(--text, #f1f5f9)',
    }}>
      {/* progress dots */}
      <div style={{ display:'flex', gap:4, marginBottom:10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 16 : 6, height: 6, borderRadius: 3,
            background: i === step ? '#0d9488' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.2s',
          }}/>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, marginBottom: 14 }}>{body}</div>
      {action === 'next_button' ? (
        <button onClick={onNext} style={{
          width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
          background: '#0d9488', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>{cta ?? 'Continue'}</button>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center' }}>Click the highlighted element to continue</div>
      )}
      <button onClick={onSkip} style={{
        display: 'block', margin: '10px auto 0', background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer',
      }}>Skip tour</button>
    </div>
  )
}

/* ─── Welcome modal ──────────────────────────────────────────────── */
function WelcomeModal({ userName, onStart, onSkip }: { userName: string; onStart: () => void; onSkip: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        background: 'var(--surface, #1e293b)', borderRadius: 20, padding: '36px 40px',
        maxWidth: 420, width: '90%', textAlign: 'center', color: 'var(--text, #f1f5f9)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
          Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
        </h2>
        <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6, marginBottom: 28 }}>
          Let's take a 60-second interactive tour of Planora so you're up and running instantly. No slides — just the real app.
        </p>
        <button onClick={onStart} style={{
          display: 'block', width: '100%', padding: '12px 0', borderRadius: 10,
          background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 15,
          border: 'none', cursor: 'pointer', marginBottom: 10,
        }}>Start tour →</button>
        <button onClick={onSkip} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: 13, cursor: 'pointer',
        }}>I'll explore on my own</button>
      </div>
    </div>
  )
}

/* ─── Done modal ─────────────────────────────────────────────────── */
function DoneModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        background: 'var(--surface, #1e293b)', borderRadius: 20, padding: '36px 40px',
        maxWidth: 400, width: '90%', textAlign: 'center', color: 'var(--text, #f1f5f9)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>You're all set!</h2>
        <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6, marginBottom: 28 }}>
          You've seen the core features. Start adding clients and watch your compliance deadlines appear automatically.
        </p>
        <button onClick={onClose} style={{
          display: 'block', width: '100%', padding: '12px 0', borderRadius: 10,
          background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 15,
          border: 'none', cursor: 'pointer',
        }}>Go to dashboard</button>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────── */
interface Props {
  userId: string
  userName: string
  userCreatedAt: string
  tourCompletedAt: string | null
}

export function InteractiveOnboarding({ userId, userName, userCreatedAt, tourCompletedAt }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [stepIdx, setStepIdx]     = useState(0)
  const [visible, setVisible]     = useState(false)
  const [rect, setRect]           = useState<DOMRect | null>(null)
  const [showDone, setShowDone]   = useState(false)
  const [confetti, setConfetti]   = useState(false)
  const rafRef    = useRef<number | null>(null)
  const cleanupFn = useRef<(() => void) | null>(null)

  const storageKey = `planora_tour_v4_${userId}`

  /* Should we show the tour at all? */
  useEffect(() => {
    if (tourCompletedAt) return
    const done = localStorage.getItem(storageKey)
    if (done) return
    // only show to accounts < 30 days old
    const created = new Date(userCreatedAt).getTime()
    if (Date.now() - created > 30 * 24 * 60 * 60 * 1000) return
    setVisible(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = useCallback(() => {
    localStorage.setItem(storageKey, '1')
    // best-effort server call to set tour_completed_at
    fetch('/api/user/tour-complete', { method: 'POST' }).catch(() => {})
  }, [storageKey])

  const finish = useCallback(() => {
    markDone()
    setConfetti(true)
    setVisible(false)
    setShowDone(true)
    setTimeout(() => setConfetti(false), 2500)
  }, [markDone])

  const skip = useCallback(() => {
    markDone()
    setVisible(false)
    if (cleanupFn.current) { cleanupFn.current(); cleanupFn.current = null }
  }, [markDone])

  /* Advance to next step (or finish) */
  const advance = useCallback(() => {
    if (cleanupFn.current) { cleanupFn.current(); cleanupFn.current = null }
    setRect(null)
    const next = stepIdx + 1
    if (next >= STEPS.length) { finish(); return }
    setStepIdx(next)
  }, [stepIdx, finish])

  /* Poll for element, measure it, attach listener */
  useEffect(() => {
    if (!visible) return
    const step = STEPS[stepIdx]
    if (step.type === 'modal') { setRect(null); return }

    // Navigate if needed
    if (step.route && pathname !== step.route) {
      router.push(step.route)
      return
    }

    let cancelled = false
    const poll = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(step.selector)
      if (el) {
        setRect(el.getBoundingClientRect())

        if (step.action === 'click_target') {
          const handler = () => { if (!cancelled) advance() }
          el.addEventListener('click', handler, { once: true })
          cleanupFn.current = () => el.removeEventListener('click', handler)
        }
        return
      }
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)

    // re-measure on resize/scroll
    const reframe = () => {
      const el = document.querySelector<HTMLElement>(step.selector)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', reframe)
    window.addEventListener('scroll', reframe, true)

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', reframe)
      window.removeEventListener('scroll', reframe, true)
    }
  }, [visible, stepIdx, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && !showDone && !confetti) return null

  const step = STEPS[stepIdx]

  return (
    <>
      {confetti && <Confetti/>}

      {showDone && <DoneModal onClose={() => { setShowDone(false); router.push('/dashboard') }}/>}

      {visible && step.type === 'modal' && (
        <WelcomeModal userName={userName} onStart={advance} onSkip={skip}/>
      )}

      {visible && step.type === 'spotlight' && rect && (
        <>
          <SpotlightOverlay rect={rect}/>
          <Tooltip
            rect={rect}
            placement={step.placement}
            title={step.title}
            body={step.body}
            step={stepIdx - 1}   // -1 because step 0 is modal
            total={STEPS.length - 1}
            action={step.action}
            cta={step.cta}
            onNext={advance}
            onSkip={skip}
          />
        </>
      )}
    </>
  )
}
