'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'upfloat_msme_wt_v1'
const ACCENT = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'

// ── Slide illustrations ────────────────────────────────────────────────────────

function IllustrationWelcome() {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="320" height="240" fill="#f0fdfa" rx="12"/>
      {/* Factory building */}
      <rect x="100" y="100" width="120" height="80" rx="4" fill={ACCENT} fillOpacity="0.15" stroke={ACCENT} strokeWidth="1.5"/>
      <rect x="115" y="115" width="22" height="28" rx="3" fill="white" stroke={ACCENT} strokeWidth="1"/>
      <rect x="147" y="115" width="22" height="28" rx="3" fill="white" stroke={ACCENT} strokeWidth="1"/>
      <rect x="179" y="115" width="22" height="28" rx="3" fill="white" stroke={ACCENT} strokeWidth="1"/>
      <rect x="130" y="148" width="60" height="32" rx="3" fill="white" stroke={ACCENT} strokeWidth="1"/>
      {/* Chimney */}
      <rect x="112" y="75" width="12" height="30" rx="3" fill={ACCENT} fillOpacity="0.4"/>
      <rect x="172" y="80" width="12" height="25" rx="3" fill={ACCENT} fillOpacity="0.4"/>
      {/* Smoke */}
      <circle cx="118" cy="68" r="7" fill={ACCENT} fillOpacity="0.12"/>
      <circle cx="123" cy="60" r="6" fill={ACCENT} fillOpacity="0.08"/>
      <circle cx="178" cy="72" r="6" fill={ACCENT} fillOpacity="0.12"/>
      {/* Checkmark badge */}
      <circle cx="220" cy="80" r="24" fill={ACCENT}/>
      <path d="M209 80 L217 89 L232 71" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Label */}
      <rect x="85" y="192" width="150" height="26" rx="6" fill={ACCENT} fillOpacity="0.1" stroke={ACCENT} strokeWidth="1" strokeOpacity="0.3"/>
      <text x="160" y="209" textAnchor="middle" fontSize="11" fontWeight="700" fill={ACCENT}>Section 43B(h) Compliant</text>
    </svg>
  )
}

function IllustrationImport() {
  const rows = [
    { name: 'Shree Steel Works',    email: 'shree@...',  status: 'Pending', color: '#64748b', bg: '#f1f5f9' },
    { name: 'ABC Fabricators',      email: 'abc@...',    status: 'Emailed', color: '#ea580c', bg: '#fff7ed' },
    { name: 'Sunrise Exports',      email: 'sunrise@...', status: 'Done ✓', color: '#16a34a', bg: '#f0fdf4' },
  ]
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="320" height="240" fill="#f8fafc" rx="12"/>
      {/* Excel icon */}
      <rect x="20" y="20" width="60" height="72" rx="6" fill="#16a34a" fillOpacity="0.15" stroke="#16a34a" strokeWidth="1.5"/>
      <text x="50" y="54" textAnchor="middle" fontSize="22" fill="#16a34a">XLS</text>
      <text x="50" y="70" textAnchor="middle" fontSize="8" fontWeight="600" fill="#16a34a">File</text>
      {/* Arrow */}
      <path d="M88 56 L108 56" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M104 50 L112 56 L104 62" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Vendor table */}
      <rect x="116" y="20" width="188" height="88" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="116" y="20" width="188" height="24" rx="8" fill={ACCENT} fillOpacity="0.08"/>
      <text x="210" y="35" textAnchor="middle" fontSize="9" fontWeight="700" fill={ACCENT}>Vendor List</text>
      {rows.map((r, i) => (
        <g key={r.name}>
          <rect x="124" y={50 + i * 20} width="172" height="17" rx="4" fill={r.bg}/>
          <text x="130" y={61 + i * 20} fontSize="8" fontWeight="600" fill={DARK}>{r.name}</text>
          <rect x="250" y={52 + i * 20} width="40" height="13" rx="4" fill={r.bg}/>
          <text x="270" y={62 + i * 20} textAnchor="middle" fontSize="7" fontWeight="700" fill={r.color}>{r.status}</text>
        </g>
      ))}
      {/* Stats at bottom */}
      {[
        { x: 60,  label: '500+', sub: 'Max import' },
        { x: 160, label: 'Auto', sub: 'Dedup emails' },
        { x: 260, label: 'Free', sub: '5 vendors' },
      ].map(({ x, label, sub }) => (
        <g key={label}>
          <rect x={x - 36} y="128" width="72" height="36" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <text x={x} y="143" textAnchor="middle" fontSize="11" fontWeight="800" fill={ACCENT}>{label}</text>
          <text x={x} y="155" textAnchor="middle" fontSize="7.5" fill={MUTED}>{sub}</text>
        </g>
      ))}
      {/* Email sequence arrow */}
      <rect x="20" y="180" width="280" height="44" rx="8" fill={ACCENT} fillOpacity="0.06" stroke={ACCENT} strokeWidth="1" strokeOpacity="0.2"/>
      {['Add', '→', 'Email', '→', 'Response', '→', 'Done ✓'].map((t, i) => (
        <text key={i} x={36 + i * 38} y="206" fontSize={t === '→' ? "12" : "8.5"} fontWeight={t === '→' ? "400" : "700"} fill={t === '→' ? MUTED : ACCENT} textAnchor="middle">{t}</text>
      ))}
    </svg>
  )
}

function IllustrationEmail() {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="320" height="240" fill="#f0fdfa" rx="12"/>
      {/* Email envelope */}
      <rect x="60" y="50" width="200" height="130" rx="10" fill="white" stroke={ACCENT} strokeWidth="2"/>
      <path d="M60 70 L160 130 L260 70" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Email content lines */}
      <rect x="90" y="108" width="140" height="8" rx="4" fill={ACCENT} fillOpacity="0.15"/>
      <rect x="100" y="122" width="120" height="6" rx="3" fill="#e2e8f0"/>
      <rect x="105" y="134" width="110" height="6" rx="3" fill="#e2e8f0"/>
      {/* Send button */}
      <rect x="110" y="150" width="100" height="22" rx="6" fill={ACCENT}/>
      <text x="160" y="165" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">✉ Submit MSME Form</text>
      {/* Auto reminders */}
      {[
        { d: 0,  label: 'Day 0 — First email', done: true },
        { d: 56, label: 'Day 7 — Reminder 2', done: false },
        { d: 112, label: 'Day 14 — Reminder 3', done: false },
      ].map(({ d, label, done }) => (
        <g key={label}>
          <circle cx={60 + d} cy="210" r="7" fill={done ? ACCENT : '#f1f5f9'} stroke={done ? ACCENT : '#e2e8f0'} strokeWidth="1.5"/>
          {done && <path d={`M${57 + d} 210 L${59 + d} 213 L${64 + d} 206`} stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>}
        </g>
      ))}
      <path d="M67 210 L116 210 M123 210 L172 210" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  )
}

function IllustrationCompliance() {
  const statuses = [
    { label: 'Udyam Reg. No.', value: 'UDYAM-MH-01-000123', color: '#16a34a' },
    { label: 'Category',       value: 'Micro Enterprise',     color: ACCENT },
    { label: 'Outstanding',    value: '₹1,20,000',            color: '#dc2626' },
    { label: '43B(h) Applies', value: 'YES — pay by Mar 31',  color: '#ea580c' },
  ]
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="320" height="240" fill="#f8fafc" rx="12"/>
      <rect x="20" y="20" width="280" height="200" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="20" y="20" width="280" height="32" rx="10" fill={ACCENT} fillOpacity="0.08"/>
      <text x="36" y="40" fontSize="10" fontWeight="700" fill={ACCENT}>43B(h) Compliance Card</text>
      <circle cx="280" cy="36" r="12" fill="#16a34a" fillOpacity="0.15" stroke="#16a34a" strokeWidth="1.5"/>
      <path d="M275 36 L278 39 L285 32" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {statuses.map((s, i) => (
        <g key={s.label}>
          <text x="36" y={72 + i * 38} fontSize="8.5" fill={MUTED} fontWeight="600">{s.label}</text>
          <rect x="34" y={78 + i * 38} width="252" height="22" rx="5" fill={s.color} fillOpacity="0.07" stroke={s.color} strokeWidth="0.8" strokeOpacity="0.3"/>
          <text x="42" y={93 + i * 38} fontSize="10" fontWeight="700" fill={s.color}>{s.value}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationUpgrade() {
  const packs = [
    { label: 'Free',    vendors: '5',   price: '₹0',      current: true },
    { label: 'Starter', vendors: '20',  price: '₹3,000',  current: false },
    { label: 'Standard',vendors: '50',  price: '₹5,500',  current: false },
    { label: 'Pro',     vendors: '200', price: '₹16,000', current: false },
  ]
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="320" height="240" fill="#f0fdfa" rx="12"/>
      {packs.map((p, i) => (
        <g key={p.label}>
          <rect x="20" y={20 + i * 52} width="280" height="44" rx="8"
            fill={p.current ? ACCENT : 'white'}
            fillOpacity={p.current ? 0.12 : 1}
            stroke={p.current ? ACCENT : '#e2e8f0'}
            strokeWidth={p.current ? 2 : 1}/>
          <text x="36" y={38 + i * 52} fontSize="11" fontWeight="800" fill={p.current ? ACCENT : DARK}>{p.label}</text>
          <text x="36" y={52 + i * 52} fontSize="9" fill={MUTED}>Up to {p.vendors} vendors</text>
          <text x="270" y={48 + i * 52} textAnchor="end" fontSize="13" fontWeight="800" fill={p.current ? ACCENT : DARK}>{p.price}</text>
          {p.current && (
            <rect x="156" y={30 + i * 52} width="48" height="15" rx="6" fill={ACCENT}/>
          )}
          {p.current && (
            <text x="180" y={41 + i * 52} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white">Current</text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ── Slide data ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    tag:   'Welcome',
    title: 'MSME Vendor Tracker',
    body:  "Automate Section 43B(h) compliance tracking for all your vendors — from adding them to getting their MSME certificates — without a single manual follow-up.",
    Illustration: IllustrationWelcome,
  },
  {
    tag:   'Add & Import',
    title: 'Add or bulk-import vendors',
    body:  'Add vendors one by one or upload an Excel/CSV file with hundreds of vendors at once. Free tier covers 5 vendors. Upgrade anytime.',
    Illustration: IllustrationImport,
  },
  {
    tag:   'Automated emails',
    title: 'Shoot emails in one click',
    body:  'Click “Shoot email” and the vendor receives a branded request form. The system automatically sends up to 5 follow-up reminders on your configured schedule.',
    Illustration: IllustrationEmail,
  },
  {
    tag:   '43B(h) Compliance',
    title: 'Real-time compliance tracking',
    body:  "Once a vendor submits their Udyam number, the tracker instantly shows their MSME category, outstanding amount, and whether Section 43B(h) applies to them.",
    Illustration: IllustrationCompliance,
  },
  {
    tag:   'Pricing',
    title: 'Flexible vendor packs',
    body:  'Start free with 5 vendors. Upgrade to a one-time pack for up to 500 vendors. Imported vendors beyond your limit appear blurred and unlock instantly after upgrade.',
    Illustration: IllustrationUpgrade,
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onUpgrade:   () => void
  onStartTour: () => void
}

export default function MsmeWalkthrough({ onUpgrade, onStartTour }: Props) {
  const [visible, setVisible] = useState(false)
  const [slide,   setSlide]   = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function handleStartTour() {
    dismiss()
    onStartTour()
  }

  if (!visible) return null

  const s    = SLIDES[slide]
  const Illo = s.Illustration
  const isLast = slide === SLIDES.length - 1

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, colorScheme: 'light' }}
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

        {/* Illustration area */}
        <div style={{ height: 220, background: 'linear-gradient(135deg, rgba(13,148,136,0.06), rgba(13,148,136,0.02))', padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 280, height: 196 }}>
            <Illo />
          </div>
        </div>

        {/* Text area */}
        <div style={{ padding: '20px 28px 24px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 20, padding: '2px 8px', letterSpacing: '0.04em' }}>
            {s.tag}
          </span>
          <h2 style={{ margin: '10px 0 8px', fontSize: 19, fontWeight: 800, color: DARK }}>{s.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{s.body}</p>

          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 22, gap: 8 }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  style={{ width: i === slide ? 20 : 7, height: 7, borderRadius: 4, border: 'none', background: i === slide ? ACCENT : '#e2e8f0', cursor: 'pointer', transition: 'width 0.2s' }}
                />
              ))}
            </div>

            <button onClick={dismiss} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
              Skip
            </button>

            {slide > 0 && (
              <button
                onClick={() => setSlide(s => s - 1)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: MUTED, cursor: 'pointer' }}
              >
                ← Back
              </button>
            )}

            {!isLast && (
              <button
                onClick={() => setSlide(s => s + 1)}
                style={{ background: ACCENT, border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
              >
                Next →
              </button>
            )}

            {isLast && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleStartTour}
                  style={{ background: ACCENT, border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                >
                  Start guided tour →
                </button>
                <button
                  onClick={dismiss}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: MUTED, cursor: 'pointer' }}
                >
                  Go to dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
