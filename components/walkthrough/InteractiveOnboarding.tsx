'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/* ─── Step definitions ───────────────────────────────────────────── */
type Placement = 'right' | 'left' | 'bottom' | 'top' | 'center'
type Action    = 'click_target' | 'next_button'

interface SpotlightStep {
  type:      'spotlight'
  selector:  string
  route?:    string            // navigate here before showing spotlight
  title:     string
  body:      string
  placement: Placement
  action:    Action
  cta?:      string
  icon?:     string
}

type Step = { type: 'modal' } | SpotlightStep

/* ── 14-step tour covering every major feature ───────────────────── */
const STEPS: Step[] = [
  /* 0 */ { type: 'modal' },

  /* 1  My Tasks — board view */
  {
    type: 'spotlight', selector: 'a[href="/tasks"]',
    route: '/dashboard',
    icon: '✅',
    title: 'My Tasks',
    body: 'Your personal task board — everything assigned to you, sorted by due date. Click to explore.',
    placement: 'right', action: 'click_target',
  },

  /* 2  Recurring tasks */
  {
    type: 'spotlight', selector: 'a[href="/recurring"]',
    icon: '🔁',
    title: 'Recurring tasks',
    body: 'Set up tasks that auto-spawn every week, month or quarter — GST returns, TDS filing, payroll — without lifting a finger.',
    placement: 'right', action: 'click_target',
  },

  /* 3  Calendar */
  {
    type: 'spotlight', selector: 'a[href="/calendar"]',
    icon: '📅',
    title: 'Calendar view',
    body: 'See all deadlines in a monthly calendar. Drag tasks to reschedule. Click to see it.',
    placement: 'right', action: 'click_target',
  },

  /* 4  CA Compliance */
  {
    type: 'spotlight', selector: 'a[href="/compliance"]',
    icon: '📋',
    title: 'CA Compliance',
    body: '69+ statutory tasks (GST, ITR, TDS, ROC…) auto-assigned per client with due dates. Click to explore.',
    placement: 'right', action: 'click_target',
  },

  /* 5  Compliance task row */
  {
    type: 'spotlight', selector: '[data-tour="compliance-task-row"]',
    route: '/compliance',
    icon: '👆',
    title: 'Click any filing task',
    body: 'Open it to mark as done, attach the filed document, or request approval from a partner.',
    placement: 'right', action: 'click_target',
  },

  /* 6  Clients */
  {
    type: 'spotlight', selector: 'a[href="/clients"]',
    icon: '👥',
    title: 'Client list',
    body: 'All your clients in one place. Add GST number, PAN, contact details and watch compliance tasks appear automatically.',
    placement: 'right', action: 'click_target',
  },

  /* 7  Add client button */
  {
    type: 'spotlight', selector: 'a[href="/clients/new"]',
    route: '/clients',
    icon: '➕',
    title: 'Add your first client',
    body: 'Takes 30 seconds. Once added, all statutory deadlines are created for that client automatically.',
    placement: 'bottom', action: 'next_button', cta: 'Got it →',
  },

  /* 8  Projects */
  {
    type: 'spotlight', selector: 'a[href="/projects"]',
    icon: '📁',
    title: 'Projects',
    body: 'Group tasks under a project — audit engagements, advisory work, company formations. Track progress at a glance.',
    placement: 'right', action: 'click_target',
  },

  /* 9  Quick-add task + billable */
  {
    type: 'spotlight', selector: '[data-tour="quick-add-task"]',
    route: '/tasks',
    icon: '💰',
    title: 'Quick-add + billable tasks',
    body: 'Click "+ Add task" to create a task in seconds. Inside each task you can mark it billable and set an amount — amounts roll up into invoices automatically.',
    placement: 'top', action: 'next_button', cta: 'Continue →',
  },

  /* 10  MSME Tracker */
  {
    type: 'spotlight', selector: 'a[href="/msme"]',
    icon: '🏭',
    title: 'MSME Tracker',
    body: "Track MSME-registered vendors, monitor 45-day payment deadlines, and stay compliant with Section 43B(h) automatically.",
    placement: 'right', action: 'click_target',
  },

  /* 11  Reports */
  {
    type: 'spotlight', selector: 'a[href="/reports"]',
    icon: '📊',
    title: 'Reports',
    body: 'See completion rates, team workload, client billing summaries and compliance health — all in one dashboard.',
    placement: 'right', action: 'click_target',
  },

  /* 12  Invoices */
  {
    type: 'spotlight', selector: 'a[href="/invoices"]',
    icon: '🧾',
    title: 'Invoices',
    body: 'Create GST-compliant invoices in seconds. Billable task amounts pre-fill automatically.',
    placement: 'right', action: 'click_target',
  },

  /* 13  Team */
  {
    type: 'spotlight', selector: 'a[href="/team"]',
    icon: '🤝',
    title: 'Invite your team',
    body: "Add article clerks, managers and partners. Assign tasks, set roles, and track who's working on what.",
    placement: 'right', action: 'next_button', cta: 'Finish tour 🎉',
  },
]

/* ─── Confetti ───────────────────────────────────────────────────── */
function Confetti() {
  const colors = ['#0d9488','#0891b2','#7c3aed','#ca8a04','#ef4444','#10b981']
  const pieces = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 1,
    size: 5 + Math.random() * 9,
    drift: (Math.random() - 0.5) * 150,
  }))
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:9999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:'absolute', top:'-12px', left:`${p.left}%`,
          width:p.size, height:p.size, borderRadius:2,
          background:p.color, opacity:0,
          animation:`cfFall 1.6s ${p.delay}s ease-in forwards`,
          '--d': `${p.drift}px`,
        } as React.CSSProperties}/>
      ))}
      <style>{`
        @keyframes cfFall {
          0%   { opacity:1; transform:translateY(0) translateX(0) rotate(0deg); }
          100% { opacity:0; transform:translateY(100vh) translateX(var(--d)) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── Spotlight overlay (4-panel + ring) ─────────────────────────── */
function SpotlightOverlay({ rect, padding = 10 }: { rect: DOMRect; padding?: number }) {
  const T = rect.top    - padding
  const L = rect.left   - padding
  const R = rect.right  + padding
  const B = rect.bottom + padding
  const dk = 'rgba(0,0,0,0.68)'
  return (
    <>
      <div style={{ position:'fixed', top:0, left:0, right:0, height:Math.max(0,T), background:dk, zIndex:9000 }}/>
      <div style={{ position:'fixed', left:0, right:0, top:Math.max(0,B), bottom:0, background:dk, zIndex:9000 }}/>
      <div style={{ position:'fixed', top:Math.max(0,T), left:0, width:Math.max(0,L), height:Math.max(0,B-T), background:dk, zIndex:9000 }}/>
      <div style={{ position:'fixed', top:Math.max(0,T), left:Math.max(0,R), right:0, height:Math.max(0,B-T), background:dk, zIndex:9000 }}/>
      <div style={{
        position:'fixed', top:T, left:L,
        width:rect.width+padding*2, height:rect.height+padding*2,
        borderRadius:10, pointerEvents:'none',
        boxShadow:'0 0 0 3px rgba(13,148,136,0.9), 0 0 0 6px rgba(13,148,136,0.25)',
        zIndex:9001, transition:'all 0.25s ease',
      }}/>
    </>
  )
}

/* ─── Skip button (always visible in top-right) ──────────────────── */
function SkipButton({ onSkip, step, total }: { onSkip: () => void; step: number; total: number }) {
  return (
    <div style={{
      position:'fixed', top:16, right:16, zIndex:9020,
      display:'flex', alignItems:'center', gap:10,
    }}>
      <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{step} / {total}</span>
      <button onClick={onSkip} style={{
        background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
        color:'rgba(255,255,255,0.7)', borderRadius:20, padding:'5px 14px',
        fontSize:12, cursor:'pointer', backdropFilter:'blur(4px)',
        transition:'background 0.15s',
      }}>Skip tour ✕</button>
    </div>
  )
}

/* ─── Tooltip ────────────────────────────────────────────────────── */
interface TooltipProps {
  rect: DOMRect; placement: Placement
  title: string; body: string; icon?: string
  step: number; total: number
  action: Action; cta?: string
  onNext: () => void; onSkip: () => void
}
function Tooltip({ rect, placement, title, body, icon, step, total, action, cta, onNext, onSkip }: TooltipProps) {
  const GAP = 18
  const W   = 272

  let style: React.CSSProperties = { position:'fixed', zIndex:9010, width:W }
  const midY = rect.top + rect.height / 2
  const midX = rect.left + rect.width / 2

  if (placement === 'right') {
    style.left = rect.right + GAP
    style.top  = Math.max(8, midY - 80)
  } else if (placement === 'left') {
    style.left = rect.left - W - GAP
    style.top  = Math.max(8, midY - 80)
  } else if (placement === 'bottom') {
    style.left = Math.max(8, midX - W / 2)
    style.top  = rect.bottom + GAP
  } else if (placement === 'top') {
    style.left = Math.max(8, midX - W / 2)
    style.top  = Math.max(8, rect.top - 160 - GAP)
  } else {
    style.left = '50%'; style.top = '50%'
    style.transform = 'translate(-50%,-50%)'
  }

  // Clamp right edge
  if (typeof style.left === 'number' && style.left + W > window.innerWidth - 8) {
    style.left = window.innerWidth - W - 8
  }

  const dotCount = total
  return (
    <div style={{
      ...style,
      background:'var(--surface,#1e293b)',
      border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:14, padding:'18px',
      boxShadow:'0 24px 64px rgba(0,0,0,0.55)',
      color:'var(--text,#f1f5f9)',
    }}>
      {/* progress bar */}
      <div style={{ display:'flex', gap:3, marginBottom:12 }}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <div key={i} style={{
            flex: i === step ? 2 : 1, height:4, borderRadius:2,
            background: i <= step ? '#0d9488' : 'rgba(255,255,255,0.15)',
            transition:'all 0.25s',
          }}/>
        ))}
      </div>

      {/* title */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
        <span style={{ fontWeight:700, fontSize:14 }}>{title}</span>
      </div>

      {/* body */}
      <div style={{ fontSize:13, opacity:0.72, lineHeight:1.55, marginBottom:16 }}>{body}</div>

      {/* action */}
      {action === 'next_button' ? (
        <button onClick={onNext} style={{
          width:'100%', padding:'9px 0', borderRadius:9, border:'none',
          background:'#0d9488', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer',
          transition:'opacity 0.15s',
        }}>{cta ?? 'Continue →'}</button>
      ) : (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          fontSize:12, color:'rgba(255,255,255,0.45)',
          background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'7px 0',
        }}>
          <span style={{ fontSize:14 }}>👆</span> Click the highlighted element
        </div>
      )}
    </div>
  )
}

/* ─── Welcome modal ──────────────────────────────────────────────── */
function WelcomeModal({ userName, onStart, onSkip }: { userName: string; onStart: () => void; onSkip: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        background:'var(--surface,#1e293b)', borderRadius:22, padding:'40px 44px',
        maxWidth:440, width:'92%', textAlign:'center', color:'var(--text,#f1f5f9)',
        boxShadow:'0 32px 80px rgba(0,0,0,0.65)', border:'1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize:52, marginBottom:14 }}>👋</div>
        <h2 style={{ fontWeight:800, fontSize:23, marginBottom:10 }}>
          Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
        </h2>
        <p style={{ fontSize:14, opacity:0.7, lineHeight:1.65, marginBottom:10 }}>
          Let's take a <strong style={{ color:'#0d9488' }}>2-minute interactive tour</strong> of upFloat.
        </p>
        <p style={{ fontSize:13, opacity:0.55, lineHeight:1.55, marginBottom:30 }}>
          You'll explore real features by clicking through the app — no boring slides.
        </p>

        {/* Feature badges */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:28 }}>
          {['✅ Tasks','🔁 Recurring','📋 Compliance','👥 Clients','📁 Projects','💰 Billing','🏭 MSME','📊 Reports','🧾 Invoices','🤝 Team'].map(f => (
            <span key={f} style={{
              fontSize:11, padding:'3px 10px', borderRadius:20,
              background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.3)',
              color:'rgba(255,255,255,0.7)',
            }}>{f}</span>
          ))}
        </div>

        <button onClick={onStart} style={{
          display:'block', width:'100%', padding:'13px 0', borderRadius:11,
          background:'#0d9488', color:'#fff', fontWeight:700, fontSize:15,
          border:'none', cursor:'pointer', marginBottom:12,
        }}>Start interactive tour →</button>
        <button onClick={onSkip} style={{
          background:'none', border:'none', color:'rgba(255,255,255,0.38)',
          fontSize:13, cursor:'pointer',
        }}>Skip — I'll explore on my own</button>
      </div>
    </div>
  )
}

/* ─── Done modal ─────────────────────────────────────────────────── */
function DoneModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        background:'var(--surface,#1e293b)', borderRadius:22, padding:'40px 44px',
        maxWidth:420, width:'92%', textAlign:'center', color:'var(--text,#f1f5f9)',
        boxShadow:'0 32px 80px rgba(0,0,0,0.65)', border:'1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize:56, marginBottom:14 }}>🎉</div>
        <h2 style={{ fontWeight:800, fontSize:23, marginBottom:10 }}>You know upFloat!</h2>
        <p style={{ fontSize:14, opacity:0.7, lineHeight:1.65, marginBottom:30 }}>
          Start by adding your first client — compliance deadlines will appear automatically within seconds.
        </p>
        <button onClick={() => onClose()} style={{
          display:'block', width:'100%', padding:'13px 0', borderRadius:11,
          background:'#0d9488', color:'#fff', fontWeight:700, fontSize:15,
          border:'none', cursor:'pointer', marginBottom:10,
        }}>Add my first client →</button>
        <button onClick={onClose} style={{
          background:'none', border:'none', color:'rgba(255,255,255,0.38)',
          fontSize:13, cursor:'pointer',
        }}>Go to dashboard</button>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────── */
interface Props {
  userId:          string
  userName:        string
  userCreatedAt:   string
  tourCompletedAt: string | null
}

export function InteractiveOnboarding({ userId, userName, userCreatedAt, tourCompletedAt }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [stepIdx,  setStepIdx]  = useState(0)
  const [visible,  setVisible]  = useState(false)
  const [rect,     setRect]     = useState<DOMRect | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [confetti, setConfetti] = useState(false)

  const rafRef    = useRef<number | null>(null)
  const cleanupFn = useRef<(() => void) | null>(null)

  const storageKey = `planora_tour_v4_${userId}`

  // Decide whether to show
  useEffect(() => {
    if (tourCompletedAt) return
    if (localStorage.getItem(storageKey)) return
    const ageDays = (Date.now() - new Date(userCreatedAt).getTime()) / 86400000
    if (ageDays > 30) return
    setVisible(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = useCallback(() => {
    localStorage.setItem(storageKey, '1')
    fetch('/api/user/tour-complete', { method:'POST' }).catch(() => {})
  }, [storageKey])

  const finish = useCallback(() => {
    if (cleanupFn.current) { cleanupFn.current(); cleanupFn.current = null }
    markDone()
    setVisible(false)
    setRect(null)
    setConfetti(true)
    setShowDone(true)
    setTimeout(() => setConfetti(false), 2200)
  }, [markDone])

  const skip = useCallback(() => {
    if (cleanupFn.current) { cleanupFn.current(); cleanupFn.current = null }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    markDone()
    setVisible(false)
    setRect(null)
  }, [markDone])

  const advance = useCallback(() => {
    if (cleanupFn.current) { cleanupFn.current(); cleanupFn.current = null }
    setRect(null)
    const next = stepIdx + 1
    if (next >= STEPS.length) { finish(); return }
    setStepIdx(next)
  }, [stepIdx, finish])

  // Poll for target element + attach click listener
  useEffect(() => {
    if (!visible) return
    const step = STEPS[stepIdx]
    if (step.type === 'modal') { setRect(null); return }

    // Navigate first if required
    if (step.route && pathname !== step.route) {
      router.push(step.route)
      return
    }

    let cancelled = false

    const measure = (el: HTMLElement) => {
      setRect(el.getBoundingClientRect())
    }

    const poll = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(step.selector)
      if (el) {
        measure(el)
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

  const step    = STEPS[stepIdx]
  // Spotlight steps start at index 1; progress shown as 1-based within spotlight steps
  const spotIdx = stepIdx - 1          // 0-based among spotlight steps
  const spotTotal = STEPS.length - 1   // total spotlight steps

  return (
    <>
      {confetti && <Confetti/>}

      {showDone && (
        <DoneModal onClose={() => {
          setShowDone(false)
          router.push('/clients/new')
        }}/>
      )}

      {visible && step.type === 'modal' && (
        <WelcomeModal userName={userName} onStart={advance} onSkip={skip}/>
      )}

      {visible && step.type === 'spotlight' && (
        <>
          {/* Always-visible skip button */}
          <SkipButton onSkip={skip} step={spotIdx + 1} total={spotTotal}/>

          {rect && (
            <>
              <SpotlightOverlay rect={rect}/>
              <Tooltip
                rect={rect}
                placement={step.placement}
                title={step.title}
                body={step.body}
                icon={step.icon}
                step={spotIdx}
                total={spotTotal}
                action={step.action}
                cta={step.cta}
                onNext={advance}
                onSkip={skip}
              />
            </>
          )}

          {/* Loading indicator while waiting for element */}
          {!rect && (
            <div style={{
              position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)',
              background:'rgba(0,0,0,0.7)', color:'rgba(255,255,255,0.7)',
              padding:'8px 20px', borderRadius:20, fontSize:13, zIndex:9010,
              backdropFilter:'blur(6px)',
            }}>Navigating…</div>
          )}
        </>
      )}
    </>
  )
}
