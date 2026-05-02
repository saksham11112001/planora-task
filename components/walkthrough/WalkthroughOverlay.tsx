'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal }    from 'react-dom'
import { useRouter }       from 'next/navigation'
import { X, ChevronRight, ChevronLeft, Sparkles, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────────────────────────────────────

interface Action {
  label: string
  href:  string
}

interface Step {
  id:      string
  icon:    string
  color:   string
  accent:  string
  title:   string
  body:    string
  chips?:  string[]
  target?: string   // CSS selector — element to spotlight
  path?:   string   // navigate here when this step becomes active (forward only)
  action?: Action   // primary CTA inside the card
}

const STEPS: Step[] = [
  {
    id:     'welcome',
    icon:   '👋',
    color:  '#0d9488',
    accent: 'rgba(13,148,136,0.12)',
    title:  'Welcome to Planora!',
    body:   "You're all set up. Let's take 60 seconds to create your first task and show you how everything works — you can skip at any time.",
    chips:  ['Task management', 'CA Compliance', 'Approval workflow', 'Client portal'],
  },
  {
    id:     'quick-tasks',
    icon:   '⚡',
    color:  '#0891b2',
    accent: 'rgba(8,145,178,0.12)',
    title:  'Create your first task',
    body:   "Start here. Hit the button below to create a Quick Task — give it a name, assign it to yourself, and set a due date. That's it. You just ran Planora.",
    chips:  ['Assignee & co-assignees', 'Due date', 'Priority', 'File attachments'],
    target: 'a[href="/inbox"]',
    path:   '/inbox',
    action: { label: 'Create your first task', href: '/inbox' },
  },
  {
    id:     'repeat-tasks',
    icon:   '🔁',
    color:  '#0d9488',
    accent: 'rgba(13,148,136,0.12)',
    title:  'Repeat Tasks',
    body:   'Tasks that auto-respawn on schedule — daily, weekly, monthly, quarterly. Set it once and it keeps coming back. Perfect for bank recs, GST returns, and monthly closings.',
    chips:  ['Daily · Weekly · Quarterly', 'Auto-creates on schedule', 'Assignable per cycle'],
    target: 'a[href="/recurring"]',
    path:   '/recurring',
  },
  {
    id:     'my-tasks',
    icon:   '📋',
    color:  '#059669',
    accent: 'rgba(5,150,105,0.12)',
    title:  'My Tasks — Kanban Board',
    body:   'A live board of everything assigned to you and your team. Drag tasks across columns to update status instantly. Subtasks keep work broken down without clutter.',
    chips:  ['Kanban + List view', 'Drag to update status', 'Subtasks on demand'],
    target: 'a[href="/tasks"]',
    path:   '/tasks',
  },
  {
    id:     'projects',
    icon:   '📁',
    color:  '#7c3aed',
    accent: 'rgba(124,58,237,0.12)',
    title:  'Projects',
    body:   'Group tasks under a project — GST Registration, Company Incorporation, ITR Filing. Track overall progress, manage team visibility, and link a client.',
    chips:  ['Progress bar', 'Team scoping', 'Client-linked', 'Templates'],
    target: 'a[href="/projects"]',
    path:   '/projects',
  },
  {
    id:     'clients',
    icon:   '👥',
    color:  '#0891b2',
    accent: 'rgba(8,145,178,0.12)',
    title:  'Clients',
    body:   'Manage every client in one place. GSTIN auto-fills all business details. DSC expiry dates are tracked with colour-coded warnings. Every task and project links back here.',
    chips:  ['GSTIN auto-fill', 'DSC expiry tracker', 'Full task history'],
    target: 'a[href="/clients"]',
    path:   '/clients',
  },
  {
    id:     'approvals',
    icon:   '✅',
    color:  '#7c3aed',
    accent: 'rgba(124,58,237,0.12)',
    title:  'Approval Workflow',
    body:   "When work is done, the assignee submits it for review. The approver approves (closing the task) or sends it back with a comment. Full audit trail maintained.",
    chips:  ['Submit → Approve / Reject', 'Rejection comments', 'Email & SMS alerts'],
    target: 'a[href="/approvals"]',
    path:   '/approvals',
  },
  {
    id:     'calendar',
    icon:   '📅',
    color:  '#d97706',
    accent: 'rgba(217,119,6,0.12)',
    title:  'Calendar',
    body:   'A month view of every task deadline and upcoming CA compliance trigger — across all clients and team members. Filter by member, task type, or client.',
    chips:  ['All deadlines in one view', 'Member filter', 'CA triggers highlighted'],
    target: 'a[href="/calendar"]',
    path:   '/calendar',
  },
  {
    id:     'compliance',
    icon:   '⚖️',
    color:  '#b45309',
    accent: 'rgba(180,83,9,0.12)',
    title:  'CA Compliance',
    body:   'Auto-generates all 69 statutory filing tasks — ITR, GST, TDS, ROC, PF, ESI, and more — for every client, on their correct due dates. The only compliance tool built for Indian CA firms.',
    chips:  ['69 compliance tasks', 'Auto-spawn on due dates', 'DSC tracker', 'Client portal'],
    target: 'a[href="/compliance"]',
    path:   '/compliance',
  },
  {
    id:     'done',
    icon:   '🚀',
    color:  '#16a34a',
    accent: 'rgba(22,163,74,0.12)',
    title:  "You're all set!",
    body:   "Now add your first client — once your clients are in, compliance tasks and project tracking come alive automatically. Go build something great.",
    chips:  ['Add a client →'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'planora_wt_v1_'
const TOOLTIP_W      = 360
const SPOTLIGHT_PAD  = 10
const TOOLTIP_GAP    = 18
// Show to accounts created within the last 7 days
const MAX_AGE_MS     = 7 * 24 * 60 * 60 * 1000

const CONFETTI_COLORS = ['#0d9488','#7c3aed','#0891b2','#d97706','#16a34a','#ec4899','#f43f5e']

function storageKey(userId: string) { return STORAGE_PREFIX + userId }

interface Rect { top: number; left: number; right: number; bottom: number; width: number; height: number }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userId:           string
  userCreatedAt:    string
  tourCompletedAt:  string | null
}

export function WalkthroughOverlay({ userId, userCreatedAt, tourCompletedAt }: Props) {
  const router                            = useRouter()
  const [step,           setStep]         = useState(0)
  const [visible,        setVisible]      = useState(false)
  const [mounted,        setMounted]      = useState(false)
  const [spotlight,      setSpot]         = useState<Rect | null>(null)
  const [animKey,        setAnimKey]      = useState(0)
  const [confettiActive, setConfetti]     = useState(false)
  const resizeTimer                       = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Stable confetti pieces (random values computed once)
  const confettiPieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id:    i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left:  8 + (i / 40) * 84 + (i % 7) * 0.8,
      delay: i * 0.018,
      size:  6 + (i % 6),
      round: i % 3 === 0,
      speed: 0.7 + (i % 5) * 0.12,
    }))
  , [])

  // 1. Mount guard (no SSR)
  useEffect(() => { setMounted(true) }, [])

  // 2. Show only for new users (account < 7 days old) who haven't completed
  //    Checks DB flag first (cross-device), then localStorage (fast path)
  useEffect(() => {
    if (!mounted) return
    if (tourCompletedAt) return                                   // DB says done — never show
    const accountAge = Date.now() - new Date(userCreatedAt).getTime()
    if (accountAge > MAX_AGE_MS) return                           // existing user
    const done = localStorage.getItem(storageKey(userId))
    if (!done) setVisible(true)
  }, [mounted, userId, userCreatedAt, tourCompletedAt])

  // 3. Keyboard navigation: → next, ← back, Esc dismiss
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')       { dismiss(); return }
      if (e.key === 'ArrowRight')   { next();    return }
      if (e.key === 'ArrowLeft')    { back();    return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step])

  // 4. Measure spotlight target whenever step changes
  const measure = useCallback(() => {
    const s = STEPS[step]
    if (!s?.target) { setSpot(null); return }
    const el = document.querySelector(s.target)
    if (!el) { setSpot(null); return }
    const r = el.getBoundingClientRect()
    setSpot({
      top:    r.top    - SPOTLIGHT_PAD,
      left:   r.left   - SPOTLIGHT_PAD,
      right:  r.right  + SPOTLIGHT_PAD,
      bottom: r.bottom + SPOTLIGHT_PAD,
      width:  r.width  + SPOTLIGHT_PAD * 2,
      height: r.height + SPOTLIGHT_PAD * 2,
    })
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [step])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(measure, 80)
    setAnimKey(k => k + 1)

    function onResize() {
      clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(measure, 120)
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); clearTimeout(resizeTimer.current); clearTimeout(t) }
  }, [visible, step, measure])

  // ── Actions ───────────────────────────────────────────────────────────────

  function dismiss() {
    localStorage.setItem(storageKey(userId), '1')
    setVisible(false)
    // Persist cross-device — fire-and-forget
    fetch('/api/user/tour-complete', { method: 'POST' }).catch(() => {})
  }

  function goTo(n: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)))
  }

  function next() {
    if (step === STEPS.length - 1) { dismiss(); return }
    const nextStep = STEPS[step + 1]
    if (nextStep?.path) router.push(nextStep.path)
    goTo(step + 1)
  }

  function back() {
    if (step > 0) goTo(step - 1)
  }

  // Last step gets a confetti burst before closing
  function handleFinish() {
    setConfetti(true)
    setTimeout(() => dismiss(), 900)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!mounted || !visible) return null

  const cur      = STEPS[step]
  const isFirst  = step === 0
  const isLast   = step === STEPS.length - 1
  const isCenter = !cur.target || !spotlight

  // Tooltip position
  let tooltipStyle: React.CSSProperties = {}

  if (isCenter) {
    tooltipStyle = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
      width:     isFirst || isLast ? 420 : TOOLTIP_W,
    }
  } else if (spotlight) {
    const vpW = window.innerWidth
    const vpH = window.innerHeight
    const tw  = TOOLTIP_W

    if (spotlight.right + TOOLTIP_GAP + tw <= vpW) {
      tooltipStyle = {
        position: 'fixed',
        left: spotlight.right + TOOLTIP_GAP,
        top:  Math.max(16, Math.min(spotlight.top + spotlight.height / 2 - 220, vpH - 460)),
        width: tw,
      }
    } else if (spotlight.left - TOOLTIP_GAP - tw >= 0) {
      tooltipStyle = {
        position: 'fixed',
        right: vpW - spotlight.left + TOOLTIP_GAP,
        top:   Math.max(16, Math.min(spotlight.top + spotlight.height / 2 - 220, vpH - 460)),
        width: tw,
      }
    } else if (spotlight.bottom + TOOLTIP_GAP + 320 <= vpH) {
      tooltipStyle = {
        position: 'fixed',
        top:  spotlight.bottom + TOOLTIP_GAP,
        left: Math.max(16, Math.min(spotlight.left + spotlight.width / 2 - tw / 2, vpW - tw - 16)),
        width: tw,
      }
    } else {
      tooltipStyle = {
        position: 'fixed',
        bottom: vpH - spotlight.top + TOOLTIP_GAP,
        left:   Math.max(16, Math.min(spotlight.left + spotlight.width / 2 - tw / 2, vpW - tw - 16)),
        width: tw,
      }
    }
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100)

  return createPortal(
    <>
      {/* ── Global styles ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes wt-tooltip-in {
          0%  { opacity:0; transform: translateY(10px) scale(0.96); }
          100%{ opacity:1; transform: translateY(0)    scale(1);    }
        }
        @keyframes wt-center-in {
          0%  { opacity:0; transform: translate(-50%,-50%) scale(0.93); }
          100%{ opacity:1; transform: translate(-50%,-50%) scale(1);    }
        }
        @keyframes wt-pulse-ring {
          0%   { transform: scale(1);    opacity: 1;   }
          50%  { transform: scale(1.05); opacity: 0.6; }
          100% { transform: scale(1);    opacity: 1;   }
        }
        @keyframes wt-chip-bounce {
          0%   { opacity:0; transform: translateY(6px); }
          100% { opacity:1; transform: translateY(0); }
        }
        @keyframes wt-action-pop {
          0%   { opacity:0; transform: translateY(8px) scale(0.97); }
          100% { opacity:1; transform: translateY(0)   scale(1);    }
        }
        @keyframes wt-confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg)   scale(1);   opacity: 1; }
          80%  { opacity: 0.9; }
          100% { transform: translateY(105vh) rotate(540deg) scale(0.8); opacity: 0; }
        }
        .wt-chip       { animation: wt-chip-bounce 0.25s ease both; }
        .wt-action-btn { animation: wt-action-pop  0.3s 0.12s cubic-bezier(0.34,1.56,0.64,1) both; }
        .wt-next-btn:hover  { filter: brightness(1.1); transform: translateY(-1px); }
        .wt-next-btn        { transition: all 0.15s ease; }
        .wt-action-btn:hover{ filter: brightness(1.05); transform: translateY(-1px) !important; box-shadow: 0 6px 20px var(--wt-color-shadow) !important; }
        .wt-dot { cursor:pointer; transition:all 0.2s ease; border:none; padding:0; }
        .wt-dot:hover { opacity:0.8; }
      `}</style>

      {/* ── Confetti burst ─────────────────────────────────────────────── */}
      {confettiActive && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999999, overflow:'hidden' }}>
          {confettiPieces.map(p => (
            <div key={p.id} style={{
              position:    'absolute',
              left:        `${p.left}%`,
              top:         '-12px',
              width:       p.size,
              height:      p.size,
              background:  p.color,
              borderRadius: p.round ? '50%' : 3,
              animation:   `wt-confetti-fall ${p.speed}s ${p.delay}s ease-in forwards`,
            }}/>
          ))}
        </div>
      )}

      {/* ── Backdrop (4 quadrants around spotlight) ─────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99990, pointerEvents: 'none' }}>
        {spotlight ? (
          <>
            <div style={{ position:'fixed', top:0, left:0, right:0, height: Math.max(0, spotlight.top),
              background:'rgba(2,6,23,0.65)', pointerEvents:'all', transition:'height 0.25s ease' }}/>
            <div style={{ position:'fixed', top: spotlight.bottom, left:0, right:0, bottom:0,
              background:'rgba(2,6,23,0.65)', pointerEvents:'all', transition:'top 0.25s ease' }}/>
            <div style={{ position:'fixed', top: spotlight.top, left:0, width: Math.max(0, spotlight.left), height: spotlight.height,
              background:'rgba(2,6,23,0.65)', pointerEvents:'all', transition:'all 0.25s ease' }}/>
            <div style={{ position:'fixed', top: spotlight.top, left: spotlight.right, right:0, height: spotlight.height,
              background:'rgba(2,6,23,0.65)', pointerEvents:'all', transition:'all 0.25s ease' }}/>
            {/* Spotlight ring — color matches current step */}
            <div style={{
              position:'fixed',
              top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height,
              borderRadius: 10, pointerEvents:'none',
              border: `2px solid ${cur.color}`,
              boxShadow: `0 0 0 4px ${cur.color}30`,
              animation: 'wt-pulse-ring 2s ease-in-out infinite',
              transition: 'all 0.25s ease',
            }}/>
          </>
        ) : (
          <div style={{ position:'fixed', inset:0, background:'rgba(2,6,23,0.65)', pointerEvents:'all' }}/>
        )}
      </div>

      {/* ── Tooltip card ──────────────────────────────────────────────────── */}
      <div
        key={animKey}
        style={{
          ...tooltipStyle,
          zIndex: 99999,
          animation: isCenter
            ? 'wt-center-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
            : 'wt-tooltip-in 0.24s cubic-bezier(0.34,1.56,0.64,1) both',
          pointerEvents: 'all',
        }}
      >
        <div style={{
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>

          {/* Progress bar */}
          <div style={{ height: 3, background: '#f1f5f9', position: 'relative' }}>
            <div style={{
              position:'absolute', inset:0, width:`${pct}%`,
              background:`linear-gradient(90deg,${cur.color},${cur.color}99)`,
              borderRadius:99, transition:'width 0.4s cubic-bezier(0.65,0,0.35,1)',
            }}/>
          </div>

          <div style={{ padding: isFirst || isLast ? '28px 28px 24px' : '20px 22px 22px' }}>

            {/* Welcome / Done: centered hero */}
            {(isFirst || isLast) && (
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{
                  width:80, height:80, borderRadius:'50%',
                  background:cur.accent,
                  border:`2px solid ${cur.color}30`,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  fontSize:38, marginBottom:12,
                  boxShadow:`0 0 0 8px ${cur.accent}, 0 8px 24px ${cur.color}30`,
                }}>{cur.icon}</div>
                {isFirst && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:8 }}>
                    <Sparkles size={12} style={{ color:cur.color }}/>
                    <span style={{ fontSize:11, fontWeight:700, color:cur.color, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                      Quick tour · ~60 seconds
                    </span>
                    <Sparkles size={12} style={{ color:cur.color }}/>
                  </div>
                )}
              </div>
            )}

            {/* Spotlight steps: icon + header row */}
            {!isFirst && !isLast && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                <div style={{
                  width:42, height:42, borderRadius:12, flexShrink:0,
                  background:cur.accent,
                  border:`1.5px solid ${cur.color}30`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20,
                  boxShadow:`0 4px 12px ${cur.color}20`,
                }}>{cur.icon}</div>
                <div style={{ flex:1, minWidth:0, paddingTop:2 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>
                    Step {step + 1} of {STEPS.length}
                  </div>
                  <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#0f172a', lineHeight:1.2 }}>
                    {cur.title}
                  </h3>
                </div>
                <button onClick={dismiss} title="Skip tour" style={{
                  width:28, height:28, borderRadius:8, border:'none', flexShrink:0,
                  background:'#f8fafc', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#94a3b8', transition:'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fee2e2'; (e.currentTarget as HTMLElement).style.color='#dc2626' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='#f8fafc'; (e.currentTarget as HTMLElement).style.color='#94a3b8' }}>
                  <X size={13}/>
                </button>
              </div>
            )}

            {/* Centered title */}
            {(isFirst || isLast) && (
              <h2 style={{ margin:'0 0 10px', fontSize:isFirst?22:20, fontWeight:800, color:'#0f172a', textAlign:'center', lineHeight:1.2 }}>
                {cur.title}
              </h2>
            )}

            {/* Body */}
            <p style={{
              margin:'0 0 16px', fontSize:13.5, color:'#475569', lineHeight:1.7,
              textAlign: isFirst || isLast ? 'center' : 'left',
            }}>
              {cur.body}
            </p>

            {/* ── Primary action CTA (e.g. "Create your first task") ──────── */}
            {cur.action && (
              <button
                className="wt-action-btn"
                onClick={(e) => {
                  e.preventDefault()
                  // Navigate to the action page but keep the walkthrough alive
                  router.push(cur.action!.href)
                }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'11px 18px', borderRadius:12, marginBottom:16, width:'100%',
                  background:`linear-gradient(135deg, ${cur.color}, ${cur.color}dd)`,
                  color:'#fff', fontSize:13.5, fontWeight:700,
                  border:'none', cursor:'pointer',
                  boxShadow:`0 4px 16px ${cur.color}40`,
                  transition:'all 0.15s ease',
                  ['--wt-color-shadow' as any]: `${cur.color}55`,
                }}
              >
                <ExternalLink size={14}/> {cur.action.label}
              </button>
            )}

            {/* Feature chips */}
            {cur.chips && cur.chips.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18,
                justifyContent: isFirst || isLast ? 'center' : 'flex-start' }}>
                {cur.chips.map((chip, i) => (
                  <span key={chip} className="wt-chip"
                    style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600,
                      background:cur.accent,
                      color:cur.color,
                      border:`1px solid ${cur.color}25`,
                      animationDelay:`${i * 40}ms`,
                    }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:cur.color, flexShrink:0, display:'inline-block' }}/>
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {/* Step dots */}
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:18,
              justifyContent: isFirst || isLast ? 'center' : 'flex-start' }}>
              {STEPS.map((s, i) => (
                <button key={i} className="wt-dot" onClick={() => goTo(i)}
                  title={`Go to step ${i + 1}`}
                  style={{
                    width: i === step ? 20 : 6,
                    height: 6,
                    borderRadius: 99,
                    background: i === step ? cur.color : i < step ? `${cur.color}55` : '#e2e8f0',
                    boxShadow: i === step ? `0 0 6px ${cur.color}60` : 'none',
                  }}/>
              ))}
            </div>

            {/* Action row */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>

              {/* Skip (always left, intentionally low-contrast) */}
              <button onClick={dismiss} style={{
                fontSize:11.5, fontWeight:500, color:'#b0bec5',
                background:'none', border:'none', cursor:'pointer',
                padding:'6px 2px', marginRight:'auto',
                transition:'color 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#64748b' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#b0bec5' }}>
                Skip
              </button>

              {/* Keyboard hint */}
              {!isFirst && !isLast && (
                <span style={{ fontSize:10, color:'#cbd5e1', fontWeight:500, marginRight:4 }}>
                  ← →
                </span>
              )}

              {/* Back */}
              {step > 0 && (
                <button onClick={back} style={{
                  display:'flex', alignItems:'center', gap:4,
                  padding:'8px 14px', borderRadius:10,
                  border:'1.5px solid #e2e8f0', background:'#fff',
                  color:'#475569', fontSize:13, fontWeight:600,
                  cursor:'pointer', transition:'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='#cbd5e1'; (e.currentTarget as HTMLElement).style.background='#f8fafc' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#e2e8f0'; (e.currentTarget as HTMLElement).style.background='#fff' }}>
                  <ChevronLeft size={14}/> Back
                </button>
              )}

              {/* Next / Start / Finish */}
              <button className="wt-next-btn" onClick={isLast ? handleFinish : next} style={{
                display:'flex', alignItems:'center', gap:6,
                padding: isLast ? '10px 22px' : '8px 18px',
                borderRadius:10, border:'none',
                background:`linear-gradient(135deg, ${cur.color}, ${cur.color}cc)`,
                color:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer',
                boxShadow:`0 4px 14px ${cur.color}45`,
                letterSpacing:'0.01em',
              }}>
                {isFirst ? <><span>Start tour</span> <ArrowRight size={14}/></>
                : isLast  ? <><CheckCircle2 size={14}/> <span>Let&apos;s go!</span></>
                :           <><span>Next</span> <ChevronRight size={14}/></>}
              </button>
            </div>

          </div>
        </div>

        {/* Arrow pointer toward highlighted element */}
        {!isCenter && spotlight && (() => {
          const vpW = window.innerWidth
          const sl  = tooltipStyle as any
          let arrowStyle: React.CSSProperties | null = null

          if (sl.left !== undefined && spotlight.right + TOOLTIP_GAP + TOOLTIP_W <= vpW) {
            const tipTop = sl.top ?? 0
            const midY   = spotlight.top + spotlight.height / 2 - tipTop
            arrowStyle = {
              position:'absolute',
              left:-10, top: Math.max(20, Math.min(midY, 280)),
              borderTop:'10px solid transparent', borderBottom:'10px solid transparent',
              borderRight:'10px solid #fff', filter:'drop-shadow(-3px 0 4px rgba(0,0,0,0.12))',
            }
          }
          if (!arrowStyle) return null
          return <div style={arrowStyle}/>
        })()}

      </div>
    </>,
    document.body
  )
}
