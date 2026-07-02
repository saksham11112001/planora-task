'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
function Hero({ loginUrl }: { loginUrl: string }) {
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
            Waiting for your clients to set up{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              MSME compliance
            </span>{' '}
            before audit?
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: C.muted, margin: '0 0 30px', maxWidth: 520 }}>
            Get your clients' MSME compliance ready with just a click of a button — collect Udyam declarations and generate Section 43B(h) reports instantly.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 34 }}>
            <Link
              href={loginUrl}
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
              Get Started Free
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
        <div style={{ animation: 'msme-slide-left 0.9s ease both', position: 'relative' }}>
          <VendorFlowMockup />

          {/* ── 3D orbit ring ─────────────────────────────────── */}
          <div
            className="msme-3d-ring"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 290,
              height: 290,
              marginLeft: -145,
              marginTop: -145,
              borderRadius: '50%',
              border: '1.5px solid rgba(13,148,136,0.22)',
              background: 'radial-gradient(ellipse, rgba(13,148,136,0.05) 0%, transparent 65%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* ── 3D floating stat card ─────────────────────────── */}
          <div
            className="msme-3d-card"
            style={{
              position: 'absolute',
              top: '12%',
              right: '-40px',
              width: 148,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(13,148,136,0.22)',
              borderRadius: 13,
              padding: '11px 13px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 18px 45px -12px rgba(13,148,136,0.22)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(13,148,136,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={11} color={C.teal} />
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: 0.3 }}>COMPLIANT</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1 }}>
              43B<span style={{ fontSize: 12, color: C.teal }}>(h)</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>auto-detected</div>
            <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.05)' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${C.teal}, ${C.emerald})` }} />
            </div>
          </div>
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
   UNLOCK TEASER (replaces pricing — builds sunk-cost psychology)
============================================================ */
function UnlockTeaser() {
  const MOCK_VENDORS = [
    { name: 'Rajesh Traders', status: 'Submitted', unlocked: true },
    { name: 'Anita Enterprises', status: 'Pending', unlocked: true },
    { name: 'Kumar & Sons', status: 'Sent', unlocked: true },
    { name: 'Mehta Pvt Ltd', status: 'Submitted', unlocked: true },
    { name: 'Singh Exports', status: 'Pending', unlocked: true },
    { name: 'Patel Industries', status: '—', unlocked: false },
    { name: 'Gupta Supplies', status: '—', unlocked: false },
    { name: 'Sharma & Co.', status: '—', unlocked: false },
  ]
  return (
    <section style={{ background: C.bgLight, padding: '88px 24px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="How it feels on day one"
          title="You import. We track. You unlock."
          subtitle="Import your entire vendor list for free. Then watch your compliance dashboard fill up — and decide when you're ready to unlock the rest."
        />

        <div className="msme-reveal" style={{ marginTop: 52, background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: '0 20px 50px rgba(15,42,39,0.10)', overflow: 'hidden' }}>
          {/* mock header */}
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Your Vendor Dashboard</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, background: 'rgba(13,148,136,0.1)', padding: '4px 12px', borderRadius: 999 }}>
              8 vendors imported
            </div>
          </div>

          {/* progress bar */}
          <div style={{ padding: '14px 22px', background: 'rgba(13,148,136,0.04)', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Compliance progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>5 / 8 tracked</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,42,39,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '62%', borderRadius: 999, background: `linear-gradient(90deg, ${C.teal}, ${C.emerald})`, transition: 'width 1s ease' }} />
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: '8px 0 0' }}>
              You've already done the hard part — your vendor list is in. Unlock the remaining 3 to reach full compliance.
            </p>
          </div>

          {/* vendor rows */}
          <div>
            {MOCK_VENDORS.map((v, i) => (
              <div key={v.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 22px', borderBottom: i < MOCK_VENDORS.length - 1 ? `1px solid ${C.border}` : 'none',
                opacity: v.unlocked ? 1 : 0.5,
                background: v.unlocked ? 'transparent' : 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(15,42,39,0.02) 4px, rgba(15,42,39,0.02) 8px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {v.unlocked
                    ? <CheckCircle2 size={15} color={C.emerald} />
                    : <Lock size={15} color={C.muted} />}
                  <span style={{ fontWeight: 600, fontSize: 14, color: v.unlocked ? C.text : C.muted }}>{v.name}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  background: v.unlocked ? (v.status === 'Submitted' ? '#f0fdf4' : v.status === 'Sent' ? 'rgba(13,148,136,0.1)' : 'rgba(245,158,11,0.1)') : 'rgba(15,42,39,0.06)',
                  color: v.unlocked ? (v.status === 'Submitted' ? '#16a34a' : v.status === 'Sent' ? C.teal : C.amber) : C.muted,
                }}>
                  {v.unlocked ? v.status : 'Locked'}
                </span>
              </div>
            ))}
          </div>

          {/* unlock CTA */}
          <div style={{ padding: '20px 22px', background: `linear-gradient(135deg, rgba(13,148,136,0.06), rgba(16,185,129,0.04))`, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: C.text, margin: '0 0 4px' }}>
                You're 62% there. Unlock everything →
              </p>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                All your data is already imported. One click to full compliance.
              </p>
            </div>
            <Link
              href="/login?redirect=/msme&mode=signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
                color: '#fff', fontWeight: 800, fontSize: 14, padding: '11px 22px',
                borderRadius: 10, textDecoration: 'none', boxShadow: '0 8px 22px rgba(13,148,136,0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              Unlock all vendors <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* reassurance strip */}
        <div className="msme-reveal" style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {[
            '✓ Import unlimited vendors for free',
            '✓ No credit card to start',
            '✓ Pay only when you\'re ready',
          ].map(t => (
            <span key={t} style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>{t}</span>
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
function CtaSection({ loginUrl }: { loginUrl: string }) {
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
          Import all your MSME vendors in minutes. No credit card required.
        </p>
        <Link
          href={loginUrl}
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
            links={['Features', 'How it works', 'Security']}
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
          Start free · No credit card
        </div>
        <div style={{ fontSize: 12.5, color: C.muted }}>Import your vendors in minutes</div>
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
      @keyframes msme-3d-card-float {
        0%, 100% { transform: perspective(700px) translateY(0px) rotateX(8deg) rotateY(-6deg); }
        35%       { transform: perspective(700px) translateY(-18px) rotateX(2deg) rotateY(7deg); }
        68%       { transform: perspective(700px) translateY(12px) rotateX(13deg) rotateY(-9deg); }
      }
      @keyframes msme-3d-ring-spin {
        0%   { transform: perspective(600px) rotateX(72deg) rotateZ(0deg); }
        100% { transform: perspective(600px) rotateX(72deg) rotateZ(360deg); }
      }
      @keyframes msme-3d-ring-pulse {
        0%, 100% { opacity: 0.45; }
        50%       { opacity: 0.18; }
      }
      .msme-3d-card { animation: msme-3d-card-float 9s ease-in-out infinite; }
      .msme-3d-ring { animation: msme-3d-ring-spin 14s linear infinite, msme-3d-ring-pulse 7s ease-in-out infinite; }

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
        .msme-testi-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  )
}

/* ============================================================
   ROOT
============================================================ */
function MsmeLandingInner() {
  useMsmeScrollReveal()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  // Persist the partner referral code as soon as the visitor lands, so attribution
  // survives regardless of which signup/login button they click. Onboarding reads
  // and clears this key. Only write when a ref is present so an organic revisit
  // never clobbers a code stored from an earlier referred visit in the same tab.
  useEffect(() => {
    if (ref) {
      try { sessionStorage.setItem('upfloat_ref_code', ref) } catch { /* private mode */ }
    }
  }, [ref])

  const loginUrl = ref
    ? `/login?redirect=/msme&mode=signup&ref=${encodeURIComponent(ref)}`
    : '/login?redirect=/msme&mode=signup'
  return (
    <>
      <Nav />
      <Hero loginUrl={loginUrl} />
      <HowItWorks />
      <ComplianceExplainer />
      <UnlockTeaser />
      <Testimonials />
      <CtaSection loginUrl={loginUrl} />
      <Footer />
      <FloatingBadge />
    </>
  )
}

export function MsmeLandingClient() {
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
      <Suspense fallback={null}>
        <MsmeLandingInner />
      </Suspense>
    </div>
  )
}
