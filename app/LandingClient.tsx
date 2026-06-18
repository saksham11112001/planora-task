'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  CheckSquare,
  Calendar,
  Users,
  Building2,
  RefreshCw,
  UserCheck,
  ArrowRight,
  Play,
  Check,
  Shield,
} from 'lucide-react'

interface Props {
  sym: string
  prices: { starter: number; pro: number; business: number }
  currName: string
}

const BG = '#030712'
const SURFACE = '#0f172a'
const TEAL = '#0d9488'
const PURPLE = '#7c3aed'
const AMBER = '#f59e0b'

const TYPE_WORDS = ['CA Firms', 'CPA Practices', 'Finance Teams', 'MSMEs']

/* ============================================================= *
 *  Scroll reveal hook
 * ============================================================= */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal, .lp-reveal-left, .lp-reveal-right')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('lp-visible')
        })
      },
      { threshold: 0.1 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

/* ============================================================= *
 *  Particle Canvas
 * ============================================================= */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0

    const particles: { x: number; y: number; vx: number; vy: number }[] = []
    const COUNT = 80

    function resize() {
      if (!canvas) return
      const parent = canvas.parentElement
      w = parent ? parent.clientWidth : window.innerWidth
      h = parent ? parent.clientHeight : window.innerHeight
      canvas.width = w
      canvas.height = h
    }

    resize()

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      })
    }

    function step() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(13,148,136,0.7)'
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(13,148,136,${0.18 * (1 - dist / 120)})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(step)
    }

    step()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    />
  )
}

/* ============================================================= *
 *  Typewriter
 * ============================================================= */
function Typewriter() {
  const [text, setText] = useState('')
  const [wordIdx, setWordIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = TYPE_WORDS[wordIdx % TYPE_WORDS.length]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && text === word) {
      timeout = setTimeout(() => setDeleting(true), 1400)
    } else if (deleting && text === '') {
      setDeleting(false)
      setWordIdx((i) => (i + 1) % TYPE_WORDS.length)
    } else {
      const next = deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1)
      timeout = setTimeout(() => setText(next), deleting ? 45 : 90)
    }

    return () => clearTimeout(timeout)
  }, [text, deleting, wordIdx])

  return (
    <span style={{ color: TEAL, whiteSpace: 'nowrap' }}>
      {text}
      <span
        className="lp-blink"
        style={{
          display: 'inline-block',
          width: 3,
          height: '0.9em',
          background: TEAL,
          marginLeft: 2,
          transform: 'translateY(2px)',
          borderRadius: 2,
        }}
      />
    </span>
  )
}

/* ============================================================= *
 *  Task Mockup (Kanban)
 * ============================================================= */
interface MockTask {
  id: number
  initial: string
  color: string
  name: string
  client: string
  due: string
  progress: number
}

const TODO_TASKS: MockTask[] = [
  { id: 0, initial: 'R', color: TEAL, name: 'GSTR-3B Filing', client: 'Reliance Traders', due: 'Jun 20', progress: 20 },
  { id: 1, initial: 'M', color: PURPLE, name: 'TDS Reconciliation', client: 'Mehta & Co', due: 'Jun 22', progress: 0 },
  { id: 2, initial: 'A', color: AMBER, name: 'Audit Prep', client: 'Apex Industries', due: 'Jun 25', progress: 10 },
]
const PROG_TASKS: MockTask[] = [
  { id: 3, initial: 'S', color: TEAL, name: 'ITR Computation', client: 'Sharma HUF', due: 'Jun 19', progress: 60 },
  { id: 4, initial: 'V', color: PURPLE, name: 'Vendor KYC', client: 'Vikram Steel', due: 'Jun 21', progress: 45 },
]
const DONE_TASKS: MockTask[] = [
  { id: 5, initial: 'K', color: TEAL, name: 'PF Return', client: 'Kumar Foods', due: 'Jun 15', progress: 100 },
  { id: 6, initial: 'D', color: AMBER, name: 'ROC Filing', client: 'Deepak Ltd', due: 'Jun 14', progress: 100 },
]

function MockCard({ task, active }: { task: MockTask; active: boolean }) {
  return (
    <div
      style={{
        background: active ? 'rgba(13,148,136,0.10)' : 'rgba(255,255,255,0.02)',
        border: active ? `1px solid ${TEAL}` : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '10px 11px',
        transition: 'all 0.5s ease',
        boxShadow: active ? '0 0 18px rgba(13,148,136,0.25)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: task.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {task.initial}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.1 }}>{task.name}</div>
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>{task.client}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span
          style={{
            fontSize: 9,
            color: '#94a3b8',
            background: 'rgba(255,255,255,0.04)',
            padding: '2px 7px',
            borderRadius: 6,
          }}
        >
          {task.due}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${task.progress}%`,
            background: `linear-gradient(90deg, ${TEAL}, ${PURPLE})`,
            borderRadius: 4,
            transition: 'width 0.9s ease',
          }}
        />
      </div>
    </div>
  )
}

function MockColumn({ title, count, tasks, activeId }: { title: string; count: number; tasks: MockTask[]; activeId: number }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', letterSpacing: 0.3 }}>{title}</span>
        <span
          style={{
            fontSize: 9,
            color: '#64748b',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 20,
            padding: '1px 7px',
          }}
        >
          {count}
        </span>
      </div>
      {tasks.map((t) => (
        <MockCard key={t.id} task={t} active={t.id === activeId} />
      ))}
    </div>
  )
}

function TaskMockup() {
  const [activeId, setActiveId] = useState(0)

  useEffect(() => {
    const all = [...TODO_TASKS, ...PROG_TASKS, ...DONE_TASKS]
    const id = setInterval(() => {
      setActiveId((prev) => {
        const idx = all.findIndex((t) => t.id === prev)
        return all[(idx + 1) % all.length].id
      })
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* window chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: AMBER }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 10 }}>upFloat — Board</span>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 16 }}>
        <MockColumn title="To Do" count={3} tasks={TODO_TASKS} activeId={activeId} />
        <MockColumn title="In Progress" count={2} tasks={PROG_TASKS} activeId={activeId} />
        <MockColumn title="Done" count={2} tasks={DONE_TASKS} activeId={activeId} />
      </div>
    </div>
  )
}

/* ============================================================= *
 *  Stat number count-up
 * ============================================================= */
function StatNumber({
  target,
  suffix,
  decimals = 0,
  label,
}: {
  target: number
  suffix: string
  decimals?: number
  label: string
}) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true
            const duration = 1600
            const start = performance.now()
            const tick = (now: number) => {
              const p = Math.min((now - start) / duration, 1)
              const eased = 1 - Math.pow(1 - p, 3)
              setVal(target * eased)
              if (p < 1) requestAnimationFrame(tick)
              else setVal(target)
            }
            requestAnimationFrame(tick)
          }
        })
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  const display = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-IN')

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 800,
          backgroundImage: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          lineHeight: 1,
        }}
      >
        {display}
        {suffix}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>{label}</div>
    </div>
  )
}

/* ============================================================= *
 *  Feature mini-previews
 * ============================================================= */
function PreviewSmartTasks() {
  const items = ['File GSTR-1', 'TDS payment', 'Bank reco', 'Send invoice']
  const [checked, setChecked] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setChecked((c) => (c + 1) % (items.length + 1)), 2000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((t, i) => {
        const done = i < checked
        return (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              key={done ? 'd' : 'u'}
              className={done ? 'lp-task-check' : ''}
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                border: done ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                background: done ? TEAL : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {done && <Check size={11} color="#fff" strokeWidth={3} />}
            </span>
            <span
              style={{
                fontSize: 12,
                color: done ? '#64748b' : '#cbd5e1',
                textDecoration: done ? 'line-through' : 'none',
                transition: 'color 0.3s',
              }}
            >
              {t}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PreviewCalendar() {
  const dots: Record<number, string> = { 3: TEAL, 8: AMBER, 12: PURPLE, 15: TEAL, 20: AMBER, 25: PURPLE }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {Array.from({ length: 28 }).map((_, i) => {
        const day = i + 1
        const dot = dots[day]
        return (
          <div
            key={day}
            style={{
              aspectRatio: '1',
              borderRadius: 5,
              background: 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              fontSize: 9,
              color: '#64748b',
            }}
          >
            {day}
            {dot && (
              <span
                className="lp-glow-pulse"
                style={{
                  position: 'absolute',
                  bottom: 2,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: dot,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PreviewPortal() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div
        className="lp-float-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'rgba(13,148,136,0.10)',
          border: `1px solid rgba(13,148,136,0.3)`,
          borderRadius: 9,
          padding: '9px 11px',
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: TEAL,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={13} color="#fff" strokeWidth={3} />
        </span>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#e2e8f0' }}>Portal shared</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Magic link sent to client</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#64748b', paddingLeft: 4 }}>portal.upfloat.app/r/9fX2…</div>
    </div>
  )
}

function PreviewMsme() {
  const rows = [
    { name: 'Vikram Steel', status: 'sent' },
    { name: 'Apex Traders', status: 'pending' },
    { name: 'Kumar Foods', status: 'sent' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r) => (
        <div
          key={r.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            padding: '7px 10px',
          }}
        >
          <span style={{ fontSize: 11.5, color: '#cbd5e1' }}>{r.name}</span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 20,
              color: r.status === 'sent' ? TEAL : AMBER,
              background: r.status === 'sent' ? 'rgba(13,148,136,0.12)' : 'rgba(245,158,11,0.12)',
            }}
          >
            {r.status === 'sent' ? '✓ Sent' : '… Pending'}
          </span>
        </div>
      ))}
    </div>
  )
}

function PreviewRecurring() {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s + 1) % 60), 1000)
    return () => clearInterval(id)
  }, [])
  const days = 4
  const hrs = 11
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Next occurrence in</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[
          { v: days, l: 'days' },
          { v: hrs, l: 'hrs' },
          { v: 59 - secs, l: 'min' },
          { v: secs, l: 'sec' },
        ].map((c) => (
          <div
            key={c.l}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 9,
              padding: '9px 0',
              width: 44,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: TEAL }}>{String(c.v).padStart(2, '0')}</div>
            <div style={{ fontSize: 8.5, color: '#64748b' }}>{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewTeam() {
  const members = [
    { i: 'AS', role: 'Owner', color: PURPLE },
    { i: 'RK', role: 'Manager', color: TEAL },
    { i: 'PV', role: 'Member', color: AMBER },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {members.map((m) => (
        <div key={m.i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: m.color,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {m.i}
          </span>
          <span style={{ fontSize: 11.5, color: '#cbd5e1', flex: 1 }}>Role:</span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              color: '#cbd5e1',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 20,
              padding: '2px 9px',
            }}
          >
            {m.role}
          </span>
          <span
            className="lp-glow-pulse"
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }}
          />
        </div>
      ))}
    </div>
  )
}

/* ============================================================= *
 *  Feature card (with 3D hover tilt)
 * ============================================================= */
function FeatureCard({
  icon,
  title,
  desc,
  preview,
  delay,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  preview: React.ReactNode
  delay: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 6, y: px * 6 })
  }

  return (
    <div
      ref={ref}
      className="lp-reveal lp-feature-card"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transitionDelay: `${delay}ms`,
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: 'rgba(13,148,136,0.12)',
          border: '1px solid rgba(13,148,136,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TEAL,
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <div
        style={{
          marginTop: 'auto',
          background: 'rgba(3,7,18,0.5)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: 14,
          minHeight: 110,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%' }}>{preview}</div>
      </div>
    </div>
  )
}

/* ============================================================= *
 *  Pricing card
 * ============================================================= */
function PricingCard({
  name,
  price,
  period,
  features,
  popular,
  sym,
  delay,
}: {
  name: string
  price: string
  period: string
  features: string[]
  popular?: boolean
  sym: string
  delay: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 5, y: px * 5 })
  }

  return (
    <div
      ref={ref}
      className="lp-reveal"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transitionDelay: `${delay}ms`,
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        position: 'relative',
        background: SURFACE,
        borderRadius: 20,
        padding: popular ? 3 : 0,
        backgroundImage: popular
          ? `linear-gradient(120deg, ${TEAL}, ${PURPLE})`
          : 'none',
        boxShadow: popular ? '0 0 40px rgba(13,148,136,0.25)' : 'none',
      }}
    >
      <div
        style={{
          background: SURFACE,
          border: popular ? 'none' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: popular ? 17 : 20,
          padding: 28,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {popular && (
          <span
            style={{
              position: 'absolute',
              top: -13,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: '#fff',
              background: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
              borderRadius: 20,
              padding: '4px 14px',
              whiteSpace: 'nowrap',
            }}
          >
            ★ Most Popular
          </span>
        )}
        <div style={{ fontSize: 15, fontWeight: 600, color: '#cbd5e1' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '14px 0 4px' }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: '#f8fafc' }}>{price}</span>
          <span style={{ fontSize: 14, color: '#64748b' }}>{period}</span>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '18px 0' }} />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
          {features.map((f) => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: '#cbd5e1' }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(13,148,136,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={11} color={TEAL} strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/login?mode=signup"
          style={{
            marginTop: 24,
            textAlign: 'center',
            padding: '12px 0',
            borderRadius: 11,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            color: popular ? '#fff' : '#cbd5e1',
            background: popular ? `linear-gradient(120deg, ${TEAL}, ${PURPLE})` : 'rgba(255,255,255,0.05)',
            border: popular ? 'none' : '1px solid rgba(255,255,255,0.1)',
          }}
        >
          Get started
        </Link>
      </div>
    </div>
  )
}

/* ============================================================= *
 *  How it works step
 * ============================================================= */
function Step({
  num,
  title,
  desc,
  side,
}: {
  num: string
  title: string
  desc: string
  side: 'left' | 'right'
}) {
  return (
    <div
      className={side === 'left' ? 'lp-reveal-left' : 'lp-reveal-right'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 14,
        position: 'relative',
        zIndex: 2,
        background: BG,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          backgroundImage: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          lineHeight: 1,
        }}
      >
        {num}
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, maxWidth: 240, lineHeight: 1.5 }}>{desc}</p>
    </div>
  )
}

/* ============================================================= *
 *  Confetti
 * ============================================================= */
function Confetti({ origin }: { origin: { x: number; y: number } }) {
  const colors = [TEAL, PURPLE, AMBER, '#ef4444', '#22c55e', '#3b82f6']
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {Array.from({ length: 40 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 40 + Math.random()
        const dist = 120 + Math.random() * 220
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        return (
          <div
            key={i}
            className="lp-confetti"
            style={
              {
                position: 'absolute',
                left: origin.x,
                top: origin.y,
                width: 8,
                height: 8,
                borderRadius: Math.random() > 0.5 ? '50%' : 2,
                background: colors[i % colors.length],
                ['--dx' as string]: `${dx}px`,
                ['--dy' as string]: `${dy}px`,
                animationDelay: `${Math.random() * 0.1}s`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/* ============================================================= *
 *  Logo
 * ============================================================= */
function Logo({ onTriple }: { onTriple: (pos: { x: number; y: number }) => void }) {
  const clicks = useRef<number[]>([])

  const handleClick = (e: React.MouseEvent) => {
    const now = Date.now()
    clicks.current = clicks.current.filter((t) => now - t < 1000)
    clicks.current.push(now)
    if (clicks.current.length >= 3) {
      clicks.current = []
      onTriple({ x: e.clientX, y: e.clientY })
    }
  }

  return (
    <Link
      href="/"
      onClick={handleClick}
      className="lp-logo"
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
    >
      <span
        className="lp-pulse-glow"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: `linear-gradient(135deg, ${TEAL}, ${PURPLE})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 800,
          color: '#fff',
        }}
      >
        uF
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', letterSpacing: -0.3 }}>upFloat</span>
    </Link>
  )
}

/* ============================================================= *
 *  Avatars
 * ============================================================= */
function Avatars() {
  const colors = [TEAL, PURPLE, AMBER, '#ef4444', '#3b82f6']
  return (
    <div style={{ display: 'flex' }}>
      {colors.map((c, i) => (
        <span
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: c,
            border: `2px solid ${BG}`,
            marginLeft: i === 0 ? 0 : -10,
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}

/* ============================================================= *
 *  MAIN
 * ============================================================= */
export function LandingClient(props: Props) {
  const { sym, prices, currName } = props
  useScrollReveal()

  const [scrolled, setScrolled] = useState(false)
  const [confetti, setConfetti] = useState<{ x: number; y: number } | null>(null)
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onHeroMove = useCallback((e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setHeroTilt({ x: -py * 16, y: px * 16 })
  }, [])

  const triggerConfetti = useCallback((pos: { x: number; y: number }) => {
    setConfetti(pos)
    setTimeout(() => setConfetti(null), 2000)
  }, [])

  const clampDeg = (v: number) => Math.max(-8, Math.min(8, v))

  return (
    <div style={{ background: BG, color: '#e2e8f0', minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>

      {confetti && <Confetti origin={confetti} />}

      {/* ============ NAV ============ */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 5vw, 48px)',
          height: 66,
          transition: 'all 0.3s ease',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          background: scrolled ? 'rgba(3,7,18,0.75)' : 'transparent',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        }}
      >
        <Logo onTriple={triggerConfetti} />
        <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="#features" style={navLink}>Features</a>
          <a href="#pricing" style={navLink}>Pricing</a>
          <Link href="/msme-landing" style={navLink}>MSME Tracker</Link>
          <Link href="/professionals" style={navLink}>Professionals</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ ...navLink, fontWeight: 600 }}>Sign in</Link>
          <Link
            href="/login?mode=signup"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none',
              padding: '9px 18px',
              borderRadius: 10,
              background: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
            }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={() => setHeroTilt({ x: 0, y: 0 })}
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: 90,
          paddingBottom: 60,
          backgroundImage:
            'radial-gradient(circle, rgba(13,148,136,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <ParticleCanvas />

        {/* glow orbs */}
        <div
          className="lp-float-1"
          style={{
            position: 'absolute',
            top: '12%',
            left: '8%',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(13,148,136,0.22), transparent 70%)`,
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="lp-float-2"
          style={{
            position: 'absolute',
            bottom: '8%',
            right: '6%',
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(124,58,237,0.20), transparent 70%)`,
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <div
          className="lp-hero-grid"
          style={{
            position: 'relative',
            zIndex: 5,
            width: '100%',
            maxWidth: 1240,
            margin: '0 auto',
            padding: '0 clamp(16px, 5vw, 48px)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'center',
          }}
        >
          {/* LEFT */}
          <div>
            <div
              className="lp-badge-bounce"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 30,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.25)',
                fontSize: 13,
                color: '#4ade80',
                marginBottom: 26,
              }}
            >
              <span className="lp-glow-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              Now live · 500+ users
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.4rem, 5.5vw, 4rem)',
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -1,
                margin: 0,
                color: '#f8fafc',
              }}
            >
              The task manager built for
              <br />
              <Typewriter />
            </h1>

            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.18rem)', color: '#94a3b8', margin: '24px 0 32px', lineHeight: 1.6, maxWidth: 520 }}>
              Streamline compliance, automate recurring filings, and collaborate with your team and clients — purpose-built for modern Indian practices.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link
                href="/login?mode=signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '13px 24px',
                  borderRadius: 12,
                  background: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
                  boxShadow: '0 10px 30px -8px rgba(13,148,136,0.5)',
                }}
              >
                Start for free <ArrowRight size={17} />
              </Link>
              <a
                href="#features"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#cbd5e1',
                  textDecoration: 'none',
                  padding: '13px 24px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Play size={15} /> See how it works
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 36 }}>
              <Avatars />
              <span style={{ fontSize: 13.5, color: '#64748b' }}>Trusted by 500+ finance professionals</span>
            </div>
          </div>

          {/* RIGHT */}
          <div
            className="lp-hero-visual"
            style={{
              position: 'relative',
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              style={{
                transform: `perspective(1200px) rotateX(${clampDeg(heroTilt.x)}deg) rotateY(${clampDeg(heroTilt.y)}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
            >
              <TaskMockup />
            </div>

            {/* floating compliance widget bottom-left */}
            <div
              className="lp-float-1"
              style={{
                position: 'absolute',
                bottom: -26,
                left: -34,
                background: SURFACE,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '12px 15px',
                boxShadow: '0 20px 50px -15px rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                zIndex: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(245,158,11,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: AMBER,
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f1f5f9' }}>69 Compliances</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>tracked automatically</div>
              </div>
            </div>

            {/* floating notification top-right */}
            <div
              className="lp-float-2"
              style={{
                position: 'absolute',
                top: -22,
                right: -30,
                background: 'rgba(13,148,136,0.14)',
                border: '1px solid rgba(13,148,136,0.4)',
                borderRadius: 12,
                padding: '10px 14px',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                zIndex: 8,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: TEAL,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={12} color="#fff" strokeWidth={3} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5eead4' }}>GST Filed Successfully</span>
            </div>
          </div>
        </div>

        {/* scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 22,
            height: 36,
            borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.15)',
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 6,
            zIndex: 5,
          }}
        >
          <span className="lp-scanline" style={{ width: 3, height: 7, borderRadius: 3, background: TEAL }} />
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '48px clamp(16px, 5vw, 48px)',
          background: 'rgba(15,23,42,0.4)',
        }}
      >
        <div
          className="lp-stats-grid"
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 32,
          }}
        >
          <StatNumber target={50000} suffix="+" label="Tasks completed" />
          <StatNumber target={500} suffix="+" label="Finance teams" />
          <StatNumber target={69} suffix="" label="Compliance types" />
          <StatNumber target={99.9} suffix="%" decimals={1} label="Uptime" />
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" style={{ padding: '90px clamp(16px, 5vw, 48px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={sectionTitle}>Everything your practice needs</h2>
            <p style={sectionSub}>One platform for tasks, compliance, clients, and your whole team.</p>
          </div>

          <div
            className="lp-features-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
            }}
          >
            <FeatureCard
              delay={0}
              icon={<CheckSquare size={22} />}
              title="Smart Tasks"
              desc="Kanban, list, and calendar views with optimistic updates and instant sync."
              preview={<PreviewSmartTasks />}
            />
            <FeatureCard
              delay={80}
              icon={<Calendar size={22} />}
              title="Compliance Calendar"
              desc="69+ statutory tasks with due-date tracking for GST, TDS, ROC and more."
              preview={<PreviewCalendar />}
            />
            <FeatureCard
              delay={160}
              icon={<Users size={22} />}
              title="Client Portal"
              desc="Magic-link portals let clients share documents — no login required."
              preview={<PreviewPortal />}
            />
            <FeatureCard
              delay={0}
              icon={<Building2 size={22} />}
              title="MSME Tracker"
              desc="Automate vendor outreach and track 45-day payment compliance."
              preview={<PreviewMsme />}
            />
            <FeatureCard
              delay={80}
              icon={<RefreshCw size={22} />}
              title="Recurring Tasks"
              desc="Define any schedule — daily, monthly, quarterly — and we spawn it on time."
              preview={<PreviewRecurring />}
            />
            <FeatureCard
              delay={160}
              icon={<UserCheck size={22} />}
              title="Team Management"
              desc="Granular roles and permissions from owner to viewer, per organisation."
              preview={<PreviewTeam />}
            />
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section style={{ padding: '90px clamp(16px, 5vw, 48px)', background: 'rgba(15,23,42,0.35)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={sectionTitle}>Get started in minutes</h2>
            <p style={sectionSub}>Three simple steps to a fully running practice.</p>
          </div>

          <div className="lp-steps" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <div className="lp-step-line" />
            <Step num="01" side="left" title="Add your clients & tasks" desc="Import clients and create tasks in seconds with smart templates." />
            <Step num="02" side="right" title="Set compliance schedules" desc="Pick from 69+ statutory tasks or build custom recurring rules." />
            <Step num="03" side="left" title="Collaborate & track" desc="Assign your team, share portals, and watch everything stay on time." />
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" style={{ padding: '90px clamp(16px, 5vw, 48px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={sectionTitle}>Simple, transparent pricing</h2>
            <p style={sectionSub}>All prices in {currName}. No hidden fees, cancel anytime.</p>
          </div>

          <div
            className="lp-pricing-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
              marginTop: 44,
              alignItems: 'stretch',
            }}
          >
            <PricingCard
              delay={0}
              sym={sym}
              name="Free"
              price={`${sym}0`}
              period="forever"
              features={['Up to 5 members', '3 projects', 'Basic tasks', 'Kanban & list views']}
            />
            <PricingCard
              delay={80}
              sym={sym}
              popular
              name="Starter"
              price={`${sym}${prices.starter}`}
              period="/mo"
              features={['Up to 15 members', 'All features', 'Recurring tasks', 'Compliance calendar', 'Client portal']}
            />
            <PricingCard
              delay={160}
              sym={sym}
              name="Pro"
              price={`${sym}${prices.pro}`}
              period="/mo"
              features={['Up to 50 members', 'Advanced reports', 'API access', 'File attachments', 'Priority support']}
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Shield size={14} /> All payments processed securely via Razorpay · Cancel anytime
          </p>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section style={{ padding: '40px clamp(16px, 5vw, 48px) 90px' }}>
        <div
          className="lp-reveal lp-cta-bg"
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            borderRadius: 28,
            padding: 'clamp(40px, 8vw, 72px) 32px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(13,148,136,0.25)',
          }}
        >
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: -0.5 }}>
            Ready to transform your practice?
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: '#94a3b8', margin: '18px auto 32px', maxWidth: 480 }}>
            Join 500+ finance teams already running on upFloat. Free to start.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/login?mode=signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                textDecoration: 'none',
                padding: '13px 26px',
                borderRadius: 12,
                background: `linear-gradient(120deg, ${TEAL}, ${PURPLE})`,
                boxShadow: '0 10px 30px -8px rgba(13,148,136,0.5)',
              }}
            >
              Start for free <ArrowRight size={17} />
            </Link>
            <Link
              href="/msme-landing"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#cbd5e1',
                textDecoration: 'none',
                padding: '13px 26px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              View MSME Tracker
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '40px clamp(16px, 5vw, 48px)',
        }}
      >
        <div
          className="lp-footer"
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <Logo onTriple={triggerConfetti} />
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link href="/privacy" style={navLink}>Privacy</Link>
            <Link href="/terms" style={navLink}>Terms</Link>
            <Link href="/professionals" style={navLink}>Professionals</Link>
            <Link href="/msme-landing" style={navLink}>MSME Tracker</Link>
          </div>
          <span style={{ fontSize: 13, color: '#64748b' }}>© 2026 upFloat</span>
        </div>
      </footer>
    </div>
  )
}

const navLink: React.CSSProperties = {
  fontSize: 14,
  color: '#94a3b8',
  textDecoration: 'none',
  transition: 'color 0.2s',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
  fontWeight: 800,
  color: '#f8fafc',
  margin: 0,
  letterSpacing: -0.6,
}

const sectionSub: React.CSSProperties = {
  fontSize: 'clamp(1rem, 2vw, 1.1rem)',
  color: '#94a3b8',
  margin: '14px auto 0',
  maxWidth: 480,
}

/* ============================================================= *
 *  CSS
 * ============================================================= */
const CSS = `
.lp-reveal, .lp-reveal-left, .lp-reveal-right {
  opacity: 0;
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.lp-reveal { transform: translateY(30px); }
.lp-reveal-left { transform: translateX(-40px); }
.lp-reveal-right { transform: translateX(40px); }
.lp-reveal.lp-visible, .lp-reveal-left.lp-visible, .lp-reveal-right.lp-visible {
  opacity: 1;
  transform: translateY(0) translateX(0);
}

.lp-feature-card { transition: transform 0.2s ease, border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.7s ease; }
.lp-feature-card:hover {
  border-color: rgba(13,148,136,0.5) !important;
  box-shadow: 0 20px 50px -20px rgba(13,148,136,0.3);
}

.lp-logo .lp-pulse-glow { transition: transform 0.5s ease; }
.lp-logo:hover .lp-pulse-glow { animation: lp-rotate-slow 1.2s ease; }

@keyframes lp-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(14px, -18px) scale(1.03); }
  66% { transform: translate(-10px, 12px) scale(0.98); }
}
.lp-float-1 { animation: lp-float-1 9s ease-in-out infinite; }

@keyframes lp-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-16px, 14px) scale(1.02); }
  66% { transform: translate(12px, -10px) scale(1); }
}
.lp-float-2 { animation: lp-float-2 11s ease-in-out infinite; }

@keyframes lp-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.5); }
  50% { box-shadow: 0 0 18px 3px rgba(13,148,136,0.45); }
}
.lp-pulse-glow { animation: lp-pulse-glow 2.6s ease-in-out infinite; }

@keyframes lp-shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes lp-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes lp-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.lp-blink { animation: lp-blink 1s step-end infinite; }

@keyframes lp-badge-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.lp-badge-bounce { animation: lp-badge-bounce 3s ease-in-out infinite; }

@keyframes lp-glow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.lp-glow-pulse { animation: lp-glow-pulse 1.8s ease-in-out infinite; }

@keyframes lp-border-dance {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes lp-card-appear {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes lp-count-spin {
  from { transform: translateY(6px); opacity: 0.4; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes lp-rotate-slow {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}

@keyframes lp-scanline {
  0% { transform: translateY(0); opacity: 1; }
  70% { transform: translateY(12px); opacity: 0.1; }
  100% { transform: translateY(0); opacity: 1; }
}
.lp-scanline { animation: lp-scanline 1.8s ease-in-out infinite; }

@keyframes lp-task-check {
  0% { transform: scale(0.4); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
.lp-task-check { animation: lp-task-check 0.35s ease-out; }

.lp-step-line {
  position: absolute;
  top: 28px;
  left: 16%;
  right: 16%;
  height: 2px;
  background: linear-gradient(90deg, ${TEAL}, ${PURPLE}, ${TEAL});
  background-size: 200% 100%;
  animation: lp-border-dance 4s linear infinite;
  z-index: 1;
}

.lp-cta-bg {
  background: linear-gradient(120deg, rgba(13,148,136,0.18), rgba(124,58,237,0.18), rgba(13,148,136,0.18));
  background-size: 200% 200%;
  animation: lp-border-dance 8s ease infinite;
}

@keyframes lp-confetti-fall {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(540deg); opacity: 0; }
}
.lp-confetti { animation: lp-confetti-fall 1.6s ease-out forwards; }

a[style] { -webkit-tap-highlight-color: transparent; }
.lp-nav-links a:hover, .lp-footer a:hover { color: #e2e8f0 !important; }

@media (max-width: 900px) {
  .lp-hero-grid { grid-template-columns: 1fr !important; }
  .lp-hero-visual { display: none !important; }
  .lp-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .lp-nav-links { display: none !important; }
  .lp-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 28px !important; }
  .lp-steps { grid-template-columns: 1fr !important; gap: 40px !important; }
  .lp-step-line { display: none !important; }
  .lp-pricing-grid { grid-template-columns: 1fr !important; max-width: 420px; margin-left: auto; margin-right: auto; }
}

@media (max-width: 560px) {
  .lp-features-grid { grid-template-columns: 1fr !important; }
}
`
