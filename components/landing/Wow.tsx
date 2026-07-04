'use client'
/**
 * Landing-page "wow layer" — shared high-end 3D / scroll effects for the
 * upFloat and MSME landing pages. Zero dependencies: pure CSS 3D transforms,
 * requestAnimationFrame, and IntersectionObserver.
 *
 * Everything here is ADDITIVE and self-contained so it can never break page
 * logic (SEO metadata, referral attribution, login URLs live in the pages).
 * All motion respects prefers-reduced-motion.
 */
import { useEffect, useRef, useState, useCallback } from 'react'

/* ── shared: reduced-motion hook ─────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', fn)
    return () => mq.removeEventListener?.('change', fn)
  }, [])
  return reduced
}

/* ── AuroraBackground ────────────────────────────────────────────────────────
   Slow-drifting layered gradient blobs behind the hero. GPU-cheap (transform +
   filter on 3 divs), sits at z-index 0 inside a position:relative parent.     */
export function AuroraBackground({ hue = 'teal' }: { hue?: 'teal' | 'orange' }) {
  const reduced = usePrefersReducedMotion()
  const blobs = hue === 'teal'
    ? ['rgba(13,148,136,0.16)', 'rgba(59,130,246,0.12)', 'rgba(16,185,129,0.14)']
    : ['rgba(234,88,12,0.14)',  'rgba(217,119,6,0.12)',  'rgba(13,148,136,0.12)']
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
      <style>{`
        @keyframes wow-aurora-a { 0%{transform:translate(-12%,-8%) scale(1)} 50%{transform:translate(10%,6%) scale(1.15)} 100%{transform:translate(-12%,-8%) scale(1)} }
        @keyframes wow-aurora-b { 0%{transform:translate(14%,10%) scale(1.1)} 50%{transform:translate(-8%,-6%) scale(0.95)} 100%{transform:translate(14%,10%) scale(1.1)} }
        @keyframes wow-aurora-c { 0%{transform:translate(0,12%) scale(1)} 50%{transform:translate(6%,-10%) scale(1.2)} 100%{transform:translate(0,12%) scale(1)} }
      `}</style>
      {blobs.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: '55vw', height: '55vw', minWidth: 420, minHeight: 420,
          left: `${[5, 45, 25][i]}%`, top: `${[-20, -10, 30][i]}%`,
          background: `radial-gradient(circle at center, ${c} 0%, transparent 65%)`,
          filter: 'blur(40px)',
          animation: reduced ? undefined : `wow-aurora-${['a', 'b', 'c'][i]} ${[26, 32, 38][i]}s ease-in-out infinite`,
          willChange: 'transform',
        }}/>
      ))}
    </div>
  )
}

/* ── Floating3DShapes ────────────────────────────────────────────────────────
   True CSS 3D objects (preserve-3d cube + rings) that slowly tumble and drift
   with scroll parallax. Decorative, pointer-events none.                     */
export function Floating3DShapes({ accent = '#0d9488' }: { accent?: string }) {
  const reduced = usePrefersReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const el = wrapRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        el.style.setProperty('--wow-parallax', String(y))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [reduced])

  const face: React.CSSProperties = {
    position: 'absolute', inset: 0,
    border: `1.5px solid ${accent}55`,
    background: `linear-gradient(135deg, ${accent}14, ${accent}05)`,
    backdropFilter: 'blur(1px)',
    borderRadius: 6,
  }
  const S = 64 // cube size

  return (
    <div ref={wrapRef} aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes wow-tumble { from{transform:rotateX(0) rotateY(0) rotateZ(0)} to{transform:rotateX(360deg) rotateY(720deg) rotateZ(360deg)} }
        @keyframes wow-ring-spin { from{transform:rotateX(72deg) rotateZ(0)} to{transform:rotateX(72deg) rotateZ(360deg)} }
        @keyframes wow-bob { 0%,100%{margin-top:0} 50%{margin-top:-18px} }
      `}</style>

      {/* 3D cube — right side of hero */}
      <div style={{
        position: 'absolute', right: '8%', top: '18%',
        width: S, height: S, perspective: 700,
        transform: 'translateY(calc(var(--wow-parallax, 0) * -0.08px))',
        animation: reduced ? undefined : 'wow-bob 7s ease-in-out infinite',
      }}>
        <div style={{ position: 'relative', width: S, height: S, transformStyle: 'preserve-3d', animation: reduced ? undefined : 'wow-tumble 36s linear infinite' }}>
          <div style={{ ...face, transform: `translateZ(${S / 2}px)` }}/>
          <div style={{ ...face, transform: `rotateY(180deg) translateZ(${S / 2}px)` }}/>
          <div style={{ ...face, transform: `rotateY(90deg) translateZ(${S / 2}px)` }}/>
          <div style={{ ...face, transform: `rotateY(-90deg) translateZ(${S / 2}px)` }}/>
          <div style={{ ...face, transform: `rotateX(90deg) translateZ(${S / 2}px)` }}/>
          <div style={{ ...face, transform: `rotateX(-90deg) translateZ(${S / 2}px)` }}/>
        </div>
      </div>

      {/* Orbit ring — left */}
      <div style={{
        position: 'absolute', left: '6%', top: '52%',
        width: 120, height: 120, perspective: 800,
        transform: 'translateY(calc(var(--wow-parallax, 0) * -0.14px))',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${accent}40`,
          animation: reduced ? undefined : 'wow-ring-spin 18s linear infinite',
        }}/>
        <div style={{
          position: 'absolute', inset: 18, borderRadius: '50%',
          border: `1.5px dashed ${accent}30`,
          animation: reduced ? undefined : 'wow-ring-spin 26s linear infinite reverse',
        }}/>
      </div>

      {/* Small floating tile — bottom right */}
      <div style={{
        position: 'absolute', right: '18%', bottom: '12%',
        width: 34, height: 34, borderRadius: 8,
        border: `1.5px solid ${accent}45`,
        background: `linear-gradient(135deg, ${accent}18, transparent)`,
        transform: 'translateY(calc(var(--wow-parallax, 0) * -0.05px)) rotate(12deg)',
        animation: reduced ? undefined : 'wow-bob 9s ease-in-out 1.5s infinite',
      }}/>
    </div>
  )
}

/* ── ScrollProgressBar ───────────────────────────────────────────────────── */
export function ScrollProgressBar({ accent = '#0d9488' }: { accent?: string }) {
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = barRef.current
        if (!el) return
        const max = document.documentElement.scrollHeight - window.innerHeight
        el.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return (
    <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 90, pointerEvents: 'none' }}>
      <div ref={barRef} style={{ height: '100%', width: '0%', background: `linear-gradient(90deg, ${accent}, #14b8a6, #5eead4)`, boxShadow: `0 0 8px ${accent}80`, borderRadius: '0 2px 2px 0' }}/>
    </div>
  )
}

/* ── Reveal — perspective rotate-in on scroll ────────────────────────────────
   Wrap any section: children rotate up from 14deg with fade + rise, staggered
   via --wow-delay. One-shot (unobserves after firing).                        */
export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ perspective: 900, ...style }}>
      <div style={{
        transform: reduced || shown ? 'none' : 'rotateX(14deg) translateY(36px)',
        opacity: reduced || shown ? 1 : 0,
        transformOrigin: 'center 80%',
        transition: `transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, opacity 0.7s ease ${delay}ms`,
        willChange: shown ? undefined : 'transform, opacity',
      }}>
        {children}
      </div>
    </div>
  )
}

/* ── CountUp — animates a number when scrolled into view ─────────────────── */
export function CountUp({ to, suffix = '', duration = 1400, style }: { to: number; suffix?: string; duration?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) { setVal(to); return }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1)
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3)))) // ease-out cubic
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [to, duration, reduced])

  return <span ref={ref} style={style}>{val.toLocaleString('en-IN')}{suffix}</span>
}

/* ── MagneticButton — CTA that leans toward the cursor ───────────────────── */
export function MagneticButton({ href, children, style, onClick }: {
  href: string; children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const reduced = usePrefersReducedMotion()

  const onMove = useCallback((e: React.MouseEvent) => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height
    el.style.transform = `translate(${dx * 8}px, ${dy * 8}px) scale(1.03)`
  }, [reduced])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (el) el.style.transform = 'translate(0, 0) scale(1)'
  }, [])

  return (
    <a ref={ref} href={href} onClick={onClick} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ display: 'inline-block', transition: 'transform 0.18s ease-out, box-shadow 0.18s ease-out', willChange: 'transform', ...style }}>
      {children}
    </a>
  )
}

/* ── StickyCTA — "Start free" pill that slides in after scrolling past hero ─
   The single biggest conversion nudge: always-visible free-to-start CTA.     */
export function StickyCTA({ href, label = 'Start free — no credit card', accent = '#0d9488' }: {
  href: string; label?: string; accent?: string
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setVisible(window.scrollY > window.innerHeight * 0.9))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', zIndex: 80,
      transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 90px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <a href={href} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: `linear-gradient(135deg, ${accent}, #0f766e)`,
        color: '#fff', textDecoration: 'none',
        padding: '13px 26px', borderRadius: 999,
        fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
        boxShadow: `0 8px 28px ${accent}66, 0 2px 8px rgba(0,0,0,0.15)`,
        whiteSpace: 'nowrap',
      }}>
        <span aria-hidden style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#5eead4', boxShadow: '0 0 0 3px rgba(94,234,212,0.35)' }}/>
        {label}
        <span aria-hidden>→</span>
      </a>
    </div>
  )
}

/* ── Marquee — infinite horizontal scroll of trust badges / features ─────── */
export function Marquee({ items, accent = '#0d9488', dark = false }: { items: string[]; accent?: string; dark?: boolean }) {
  const reduced = usePrefersReducedMotion()
  const row = items.map((t, i) => (
    <span key={i} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 18px', margin: '0 8px',
      border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0', borderRadius: 999,
      background: dark ? 'rgba(255,255,255,0.05)' : '#fff',
      color: dark ? '#cbd5e1' : '#334155', fontSize: 13, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span aria-hidden style={{ color: accent, fontWeight: 800 }}>✓</span>{t}
    </span>
  ))
  return (
    <div aria-hidden style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <style>{`@keyframes wow-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }`}</style>
      <div style={{
        display: 'inline-flex', padding: '6px 0',
        animation: reduced ? undefined : 'wow-marquee 36s linear infinite',
        willChange: 'transform',
      }}>
        <div style={{ display: 'inline-flex' }}>{row}</div>
        <div style={{ display: 'inline-flex' }}>{row}</div>
      </div>
    </div>
  )
}

/* ── SheenCard — glossy light sweep on hover, with 3D tilt ───────────────── */
export function SheenCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  const onMove = useCallback((e: React.MouseEvent) => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 7}deg) translateY(-3px)`
    el.style.setProperty('--wow-sheen-x', `${px * 100}%`)
    el.style.setProperty('--wow-sheen-y', `${py * 100}%`)
  }, [reduced])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (el) el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0)'
  }, [])

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ position: 'relative', transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out', willChange: 'transform', overflow: 'hidden', ...style }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(circle at var(--wow-sheen-x, 50%) var(--wow-sheen-y, 50%), rgba(255,255,255,0.35) 0%, transparent 45%)',
        opacity: 0.7,
      }}/>
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}
