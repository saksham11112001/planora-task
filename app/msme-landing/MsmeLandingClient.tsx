'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Clock,
  FileText,
  Lock,
  CheckCircle2,
  Upload,
  Send,
  Download,
  ShieldCheck,
  AlertTriangle,
  Star,
  ArrowRight,
  Building2,
  X,
  Sparkles,
  IndianRupee,
} from 'lucide-react'

/* ============================================================
   Color palette
============================================================ */
const C = {
  bgLight: '#f0fdfa',
  bgLight2: '#ccfbf1',
  bgDark: '#0f2a27',
  surface: '#ffffff',
  teal: '#0d9488',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  text: '#0f172a',
  muted: '#64748b',
  border: 'rgba(15,42,39,0.08)',
}

/* ============================================================
   Scroll reveal hook
============================================================ */
function useMsmeScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.msme-reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('msme-visible')
        })
      },
      { threshold: 0.1 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

/* ============================================================
   Sticky nav shadow on scroll
============================================================ */
function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

/* ============================================================
   Animated counter
============================================================ */
function useCountUp(target: number, durationMs = 1500, start = false) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const tick = (t: number) => {
      if (startTime === null) startTime = t
      const progress = Math.min((t - startTime) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs, start])
  return value
}

function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setInView(true)
        })
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

/* ============================================================
   NAV
============================================================ */
function Nav() {
  const scrolled = useScrolled()
  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        boxShadow: scrolled ? '0 4px 24px rgba(15,42,39,0.08)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 20,
              boxShadow: '0 4px 12px rgba(13,148,136,0.35)',
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: '-0.02em' }}>
            MSME Tracker
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.teal,
              background: 'rgba(13,148,136,0.1)',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            by upFloat
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            href="/login?redirect=/msme"
            style={{ color: C.text, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
          >
            Login
          </Link>
          <Link
            href="/login?redirect=/msme&mode=signup"
            style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '10px 18px',
              borderRadius: 10,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
            }}
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ============================================================
   VENDOR FLOW MOCKUP
============================================================ */
type VendorState = 'sent' | 'pending' | 'submitted' | 'locked'

interface Vendor {
  name: string
  state: VendorState
  progress: number
}

const STATE_META: Record<
  VendorState,
  { label: string; color: string; dot: string; icon: React.ReactNode }
> = {
  sent: { label: 'Sent', color: C.emerald, dot: C.emerald, icon: <Mail size={14} /> },
  pending: { label: 'Pending', color: C.amber, dot: C.amber, icon: <Clock size={14} /> },
  submitted: { label: 'Submitted', color: C.teal, dot: C.teal, icon: <FileText size={14} /> },
  locked: { label: 'Locked', color: C.muted, dot: C.muted, icon: <Lock size={14} /> },
}

function VendorRow({
  vendor,
  flying,
  index,
}: {
  vendor: Vendor
  flying: boolean
  index: number
}) {
  const meta = STATE_META[vendor.state]
  const isLocked = vendor.state === 'locked'
  return (
    <div
      style={{
        opacity: isLocked ? 0.55 : 1,
        animation: `msme-vendor-card 0.6s ease both`,
        animationDelay: `${0.15 * index}s`,
        padding: '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: meta.dot,
              flexShrink: 0,
              animation: isLocked ? 'none' : 'msme-pulse-dot 1.6s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              color: C.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {vendor.name}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: meta.color,
            fontWeight: 700,
            fontSize: 12,
            background: `${meta.color}1a`,
            padding: '4px 9px',
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {meta.icon}
          {meta.label}
        </div>
      </div>
      {/* progress */}
      <div
        style={{
          marginTop: 9,
          height: 5,
          borderRadius: 999,
          background: 'rgba(15,42,39,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${vendor.progress}%`,
            background: `linear-gradient(90deg, ${meta.color}, ${C.emerald})`,
            borderRadius: 999,
            transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
      {/* flying envelope */}
      {flying && (
        <span
          style={{
            position: 'absolute',
            left: 18,
            top: 12,
            color: C.teal,
            animation: 'msme-email-send 1.2s ease-out',
            pointerEvents: 'none',
          }}
        >
          <Send size={16} />
        </span>
      )}
    </div>
  )
}

function VendorFlowMockup() {
  const baseVendors: Vendor[] = [
    { name: 'Rajesh Traders', state: 'sent', progress: 100 },
    { name: 'Anita Enterprises', state: 'pending', progress: 30 },
    { name: 'Kumar & Sons', state: 'submitted', progress: 80 },
    { name: 'Mehta Pvt Ltd', state: 'locked', progress: 0 },
  ]
  const [vendors, setVendors] = useState<Vendor[]>(baseVendors)
  const [flyingIndex, setFlyingIndex] = useState<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const cycleRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      const cycle = cycleRef.current % 3
      cycleRef.current += 1

      // pick a non-locked vendor to "email"
      const target = cycle === 0 ? 1 : cycle === 1 ? 0 : 2
      setFlyingIndex(target)
      setShowToast(true)

      setVendors((prev) =>
        prev.map((v, i) => {
          if (i !== target || v.state === 'locked') return v
          // advance the state
          let next: VendorState = v.state
          let prog = v.progress
          if (v.state === 'pending') {
            next = 'sent'
            prog = 60
          } else if (v.state === 'sent') {
            next = 'submitted'
            prog = 100
          } else if (v.state === 'submitted') {
            next = 'sent'
            prog = 90
          }
          return { ...v, state: next, progress: prog }
        })
      )

      window.setTimeout(() => setFlyingIndex(null), 1200)
      window.setTimeout(() => setShowToast(false), 2200)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ position: 'relative', maxWidth: 420, margin: '0 auto' }}>
      {/* floating shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 'auto 8% -22px 8%',
          height: 40,
          background: 'rgba(13,148,136,0.25)',
          filter: 'blur(28px)',
          borderRadius: '50%',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: C.surface,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          boxShadow: '0 30px 60px rgba(15,42,39,0.22)',
          overflow: 'hidden',
          animation: 'msme-float-up 5s ease-in-out infinite',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            background: `linear-gradient(135deg, ${C.bgLight}, ${C.surface})`,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: C.teal,
              animation: 'msme-pulse-dot 2s ease-in-out infinite',
            }}
          />
          <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Vendor Tracker</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 700,
              color: C.teal,
              background: 'rgba(13,148,136,0.1)',
              padding: '3px 9px',
              borderRadius: 999,
            }}
          >
            4 vendors
          </span>
        </div>
        {/* rows */}
        <div>
          {vendors.map((v, i) => (
            <VendorRow key={v.name} vendor={v} flying={flyingIndex === i} index={i} />
          ))}
        </div>
        {/* toast */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 50,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: C.emerald,
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(16,185,129,0.4)',
              opacity: showToast ? 1 : 0,
              transform: showToast ? 'translateY(0)' : 'translateY(8px)',
              transition: 'all 0.4s ease',
            }}
          >
            <CheckCircle2 size={16} />
            Email sent!
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   HERO
============================================================ */
function Hero() {
  return (
    <section
      style={{
        background: `linear-gradient(160deg, ${C.bgLight} 0%, ${C.bgLight2} 100%)`,
        padding: '72px 24px 96px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* decorative floating blobs */}
      <div
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)',
          animation: 'msme-float-down 8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)',
          gap: 56,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
        className="msme-hero-grid"
      >
        {/* LEFT */}
        <div style={{ animation: 'msme-slide-right 0.8s ease both' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(13,148,136,0.12)',
              color: C.teal,
              fontWeight: 700,
              fontSize: 13,
              padding: '7px 14px',
              borderRadius: 999,
              marginBottom: 22,
              animation: 'msme-badge-glow 2.4s ease-in-out infinite',
            }}
          >
            <ShieldCheck size={15} />
            Section 43B(h) Compliant ✓
          </div>
          <h1
            style={{
              fontSize: 'clamp(34px, 5vw, 56px)',
              lineHeight: 1.05,
              fontWeight: 900,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: '0 0 20px',
            }}
          >
            Never miss an{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              MSME payment
            </span>{' '}
            deadline again
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: C.muted, margin: '0 0 30px', maxWidth: 520 }}>
            Automatically collect Udyam declarations from vendors, track payment timelines, and
            generate Section 43B(h) compliance reports — all in one place.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 34 }}>
            <Link
              href="/login?redirect=/msme&mode=signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 26px',
                borderRadius: 12,
                textDecoration: 'none',
                boxShadow: '0 10px 28px rgba(13,148,136,0.4)',
              }}
            >
              Start Free — Up to 5 vendors
              <ArrowRight size={18} />
            </Link>
            <a
              href="#how"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                color: C.text,
                fontWeight: 700,
                fontSize: 16,
                padding: '15px 24px',
                borderRadius: 12,
                textDecoration: 'none',
                border: `1.5px solid ${C.border}`,
              }}
            >
              Watch demo
            </a>
          </div>
          {/* stats row */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Stat label="vendors tracked" value="200+" />
            <Divider />
            <Stat label="to start" value="₹0" />
            <Divider />
            <Stat label="reminders" value="30-day" />
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ animation: 'msme-slide-left 0.9s ease both' }}>
          <VendorFlowMockup />
        </div>
      </div>
    </section>
  )
}

function Divider() {
  return <span style={{ width: 1, alignSelf: 'stretch', background: C.border }} />
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 24, color: C.text, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

/* ============================================================
   HOW IT WORKS
============================================================ */
const STEPS = [
  {
    n: 1,
    icon: <Upload size={26} />,
    title: 'Import Vendors',
    body: 'Upload CSV or add one by one. Fetches GSTIN details automatically.',
  },
  {
    n: 2,
    icon: <Send size={26} />,
    title: 'Send Smart Emails',
    body: 'One click sends branded email with unique form link. Auto-reminders.',
  },
  {
    n: 3,
    icon: <Download size={26} />,
    title: 'Track & Export',
    body: 'Real-time dashboard. Export Section 43B(h) report for your CA.',
  },
]

function HowItWorks() {
  return (
    <section id="how" style={{ background: C.surface, padding: '88px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to full compliance"
          subtitle="From scattered spreadsheets to an audit-ready report — in minutes."
        />
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
            marginTop: 56,
          }}
          className="msme-steps-grid"
        >
          {/* animated dashed connector */}
          <div
            className="msme-connector"
            style={{
              position: 'absolute',
              top: 40,
              left: '16%',
              right: '16%',
              height: 2,
              borderTop: `2px dashed ${C.teal}`,
              opacity: 0.45,
              zIndex: 0,
            }}
          />
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="msme-reveal"
              style={{
                position: 'relative',
                zIndex: 1,
                background: C.surface,
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                padding: '28px 24px',
                textAlign: 'center',
                boxShadow: '0 8px 28px rgba(15,42,39,0.06)',
                transitionDelay: `${i * 0.12}s`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  margin: '0 auto 18px',
                  background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 24px rgba(13,148,136,0.35)',
                  position: 'relative',
                }}
              >
                {s.icon}
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: C.amber,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid #fff',
                  }}
                >
                  {s.n}
                </span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.muted, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light = false,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  light?: boolean
}) {
  return (
    <div className="msme-reveal" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
      <div
        style={{
          display: 'inline-block',
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: light ? C.emerald : C.teal,
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontSize: 'clamp(26px, 3.6vw, 40px)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: light ? '#fff' : C.text,
          margin: '0 0 14px',
          lineHeight: 1.12,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: light ? 'rgba(255,255,255,0.75)' : C.muted,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

/* ============================================================
   SECTION 43B(h) EXPLAINER
============================================================ */
function ComplianceExplainer() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4)
  const owed = useCountUp(1000000, 1400, inView)
  const disallowance = useCountUp(300000, 1800, inView)

  return (
    <section
      style={{
        background: `linear-gradient(160deg, ${C.bgDark} 0%, #0a201d 100%)`,
        padding: '92px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: -100,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.2), transparent 70%)',
          animation: 'msme-float-up 9s ease-in-out infinite',
        }}
      />
      <div style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <SectionHeading
          eyebrow="Know the law"
          title="What is Section 43B(h)?"
          light
        />
        <div
          ref={ref}
          className="msme-reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: 28,
            marginTop: 48,
          }}
          // grid collapses on mobile via class
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18,
              padding: '30px 28px',
            }}
            className="msme-43b-card"
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: C.amber,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <AlertTriangle size={16} />
              Effective from FY 2023-24
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
              Payments to MSME vendors must be made within{' '}
              <strong style={{ color: '#fff' }}>45 days</strong> (or{' '}
              <strong style={{ color: '#fff' }}>15 days</strong> under a written agreement) — or the
              expense is <strong style={{ color: C.amber }}>disallowed</strong> as a business
              deduction, raising your taxable profit.
            </p>
          </div>

          {/* penalty calculator */}
          <div
            style={{
              background: `linear-gradient(135deg, rgba(239,68,68,0.16), rgba(245,158,11,0.12))`,
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 18,
              padding: '28px 26px',
            }}
            className="msme-43b-card"
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              Unpaid MSME dues past 45 days
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.02em',
                animation: 'msme-count 0.6s ease',
              }}
            >
              ₹{owed.toLocaleString('en-IN')}
            </div>
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.15)',
                margin: '18px 0',
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              Estimated tax disallowance (~30%)
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: C.amber,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <IndianRupee size={26} />
              {disallowance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 40 }} className="msme-reveal">
          <Link
            href="/login?redirect=/msme&mode=signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              background: '#fff',
              color: C.teal,
              fontWeight: 800,
              fontSize: 16,
              padding: '15px 28px',
              borderRadius: 12,
              textDecoration: 'none',
              boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
            }}
          >
            Check your compliance
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   PRICING
============================================================ */
interface Plan {
  name: string
  price: string
  was?: string
  vendors: string
  features: string[]
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    vendors: '5 vendors',
    features: ['Basic vendor tracking', 'Email declarations', 'Status dashboard'],
  },
  {
    name: 'Starter',
    price: '₹3,000',
    was: '₹5,000',
    vendors: '20 vendors',
    features: ['All Free features', 'Auto-reminders', 'CSV import', '43B(h) report export'],
  },
  {
    name: 'Standard',
    price: '₹5,500',
    was: '₹9,000',
    vendors: '50 vendors',
    features: ['All Starter features', 'Priority support', 'GSTIN auto-fetch', 'Branded emails'],
    popular: true,
  },
  {
    name: 'Professional',
    price: '₹16,000',
    was: '₹24,000',
    vendors: '200 vendors',
    features: ['All Standard features', 'Dedicated support', 'Bulk operations', 'API access'],
  },
]

function PricingCard({ plan, index }: { plan: Plan; index: number }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="msme-reveal"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: plan.popular ? `linear-gradient(170deg, #ffffff, ${C.bgLight})` : C.surface,
        border: plan.popular ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '30px 24px',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        transform: hover ? 'translateY(-8px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 24px 50px rgba(13,148,136,0.22)'
          : plan.popular
          ? '0 16px 40px rgba(13,148,136,0.16)'
          : '0 8px 24px rgba(15,42,39,0.06)',
        transitionDelay: `${index * 0.08}s`,
      }}
    >
      {plan.popular && (
        <div
          style={{
            position: 'absolute',
            top: -13,
            left: '50%',
            transform: 'translateX(-50%)',
            background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            padding: '5px 16px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 16px rgba(13,148,136,0.4)',
          }}
        >
          Most Popular
        </div>
      )}
      <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 16 }}>
        {plan.vendors}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
          {plan.price}
        </span>
        {plan.was && (
          <span style={{ fontSize: 16, color: C.muted, textDecoration: 'line-through' }}>
            {plan.was}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 700,
          color: C.teal,
          background: 'rgba(13,148,136,0.1)',
          padding: '4px 10px',
          borderRadius: 999,
          marginBottom: 22,
        }}
      >
        Pay once, use forever
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
        {plan.features.map((f) => (
          <li
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 14,
              color: C.text,
              padding: '7px 0',
            }}
          >
            <CheckCircle2 size={16} color={C.emerald} style={{ flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/login?redirect=/msme&mode=signup"
        style={{
          display: 'block',
          textAlign: 'center',
          background: plan.popular ? `linear-gradient(135deg, ${C.teal}, ${C.emerald})` : 'transparent',
          color: plan.popular ? '#fff' : C.teal,
          border: plan.popular ? 'none' : `1.5px solid ${C.teal}`,
          fontWeight: 800,
          fontSize: 15,
          padding: '13px',
          borderRadius: 11,
          textDecoration: 'none',
          boxShadow: plan.popular ? '0 8px 22px rgba(13,148,136,0.35)' : 'none',
        }}
      >
        {plan.price === '₹0' ? 'Start Free' : 'Buy Now'}
      </Link>
    </div>
  )
}

function Pricing() {
  return (
    <section style={{ background: C.surface, padding: '88px 24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="Pricing"
          title="One-time payment. No subscriptions."
          subtitle="Pick the pack that matches your vendor count. Upgrade anytime."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 22,
            marginTop: 56,
            alignItems: 'start',
          }}
          className="msme-pricing-grid"
        >
          {PLANS.map((p, i) => (
            <PricingCard key={p.name} plan={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TESTIMONIALS
============================================================ */
const TESTIMONIALS = [
  {
    quote:
      'Our CA firm used to spend 2 days tracking MSME declarations. Now it’s 20 minutes.',
    name: 'Rajesh Gupta',
    role: 'Delhi CA',
    initials: 'RG',
  },
  {
    quote: 'The automated emails saved us from ₹8 lakh in tax disallowances last year.',
    name: 'Priya Sharma',
    role: 'Mumbai CFO',
    initials: 'PS',
  },
  {
    quote: 'Simple interface, works perfectly for our 45 MSME vendors.',
    name: 'Arun Mehta',
    role: 'Bangalore CA',
    initials: 'AM',
  },
]

function Testimonials() {
  return (
    <section style={{ background: C.bgLight, padding: '88px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="Loved by professionals"
          title="Trusted by CAs and finance teams"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            marginTop: 52,
          }}
          className="msme-testi-grid"
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className="msme-reveal"
              style={{
                background: C.surface,
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                padding: '28px 26px',
                boxShadow: '0 10px 30px rgba(15,42,39,0.07)',
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} size={17} fill={C.amber} color={C.amber} />
                ))}
              </div>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: C.text,
                  margin: '0 0 22px',
                  fontWeight: 500,
                }}
              >
                “{t.quote}”
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: C.text }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   CTA SECTION
============================================================ */
function CtaSection() {
  return (
    <section
      style={{
        background: `linear-gradient(135deg, ${C.teal} 0%, ${C.bgDark} 100%)`,
        padding: '92px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)',
          animation: 'msme-spin-slow 8s linear infinite',
        }}
      />
      <div
        className="msme-reveal"
        style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.02em',
            margin: '0 0 16px',
            lineHeight: 1.12,
          }}
        >
          Start tracking MSME compliance today
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.82)', margin: '0 0 32px' }}>
          Free tier includes up to 5 vendors. No credit card required.
        </p>
        <Link
          href="/login?redirect=/msme&mode=signup"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            background: '#fff',
            color: C.teal,
            fontWeight: 800,
            fontSize: 17,
            padding: '16px 32px',
            borderRadius: 13,
            textDecoration: 'none',
            boxShadow: '0 14px 36px rgba(0,0,0,0.28)',
          }}
        >
          Get Started Free
          <ArrowRight size={19} />
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
============================================================ */
function Footer() {
  return (
    <footer style={{ background: C.bgDark, padding: '52px 24px 36px', color: '#fff' }}>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 32,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ maxWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              M
            </div>
            <span style={{ fontWeight: 800, fontSize: 17 }}>MSME Tracker</span>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
            Section 43B(h) compliance, automated. Collect declarations, track timelines, export
            audit-ready reports.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
          <FooterCol
            heading="Product"
            links={['Features', 'Pricing', 'How it works', 'Security']}
          />
          <FooterCol heading="Company" links={['About upFloat', 'Contact', 'Privacy', 'Terms']} />
        </div>
      </div>
      <div
        style={{
          maxWidth: 1080,
          margin: '36px auto 0',
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        Made with{' '}
        <span style={{ color: C.red }}>♥</span> for Indian businesses · © 2026 upFloat
      </div>
    </footer>
  )
}

function FooterCol({ heading, links }: { heading: string; links: string[] }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{heading}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {links.map((l) => (
          <li key={l} style={{ marginBottom: 10 }}>
            <a
              href="#"
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.62)',
                textDecoration: 'none',
              }}
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================
   FLOATING SURPRISE BADGE
============================================================ */
function FloatingBadge() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight
      const total = document.documentElement.scrollHeight
      if (total > 0 && scrolled / total >= 0.8) setShow(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (dismissed || !show) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 22,
        right: 22,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 20px 50px rgba(15,42,39,0.25)',
        animation: 'msme-slide-left 0.5s ease both',
        maxWidth: 320,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'rgba(245,158,11,0.15)',
          color: C.amber,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={20} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>
          🎉 First 5 vendors FREE
        </div>
        <div style={{ fontSize: 12.5, color: C.muted }}>No credit card needed</div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: C.muted,
          padding: 4,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

/* ============================================================
   GLOBAL STYLES (keyframes + responsive)
============================================================ */
function GlobalStyles() {
  return (
    <style>{`
      @keyframes msme-float-up {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
      @keyframes msme-float-down {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(14px); }
      }
      @keyframes msme-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes msme-slide-right {
        from { opacity: 0; transform: translateX(-40px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes msme-slide-left {
        from { opacity: 0; transform: translateX(40px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes msme-pulse-dot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.4); opacity: 0.7; }
      }
      @keyframes msme-email-send {
        0% { transform: translateX(0); opacity: 1; }
        60% { transform: translateX(20px); opacity: 0.6; }
        100% { transform: translateX(0); opacity: 0; }
      }
      @keyframes msme-check-pop {
        0% { transform: scale(0) rotate(-20deg); }
        60% { transform: scale(1.2) rotate(6deg); }
        100% { transform: scale(1) rotate(0); }
      }
      @keyframes msme-progress {
        from { width: 0; }
        to { width: var(--msme-target, 100%); }
      }
      @keyframes msme-badge-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.0); }
        50% { box-shadow: 0 0 0 6px rgba(13,148,136,0.12); }
      }
      @keyframes msme-count {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes msme-vendor-card {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes msme-reveal {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes msme-spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes msme-dash {
        to { background-position: 200px 0; }
      }

      .msme-reveal {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      .msme-reveal.msme-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .msme-connector {
        background-image: repeating-linear-gradient(90deg, ${C.teal} 0 8px, transparent 8px 16px);
        border-top: none !important;
        height: 2px;
        background-size: 200px 2px;
        animation: msme-dash 4s linear infinite;
      }

      @media (max-width: 920px) {
        .msme-hero-grid { grid-template-columns: 1fr !important; }
        .msme-steps-grid { grid-template-columns: 1fr !important; }
        .msme-connector { display: none; }
        .msme-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .msme-testi-grid { grid-template-columns: 1fr !important; }
        .msme-43b-card { }
        section [class~="msme-43b-card"] { }
      }
      @media (max-width: 720px) {
        .msme-pricing-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  )
}

/* ============================================================
   ROOT
============================================================ */
export function MsmeLandingClient() {
  useMsmeScrollReveal()
  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: C.text,
        background: C.surface,
        overflowX: 'hidden',
      }}
    >
      <GlobalStyles />
      <Nav />
      <Hero />
      <HowItWorks />
      <ComplianceExplainer />
      <Pricing />
      <Testimonials />
      <CtaSection />
      <Footer />
      <FloatingBadge />
    </div>
  )
}
