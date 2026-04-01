import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) redirect('/dashboard')
  } catch {}

  const F = '#f97316'
  const T = '#0d9488'
  const P = '#7c3aed'
  const D = '#0f172a'
  const M = '#64748b'
  const S = '#f8fafc'
  const W = '#ffffff'

  const primaryCTA: CSSProperties = {
    background: F,
    color: W,
    padding: '13px 28px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    boxShadow: '0 4px 20px rgba(249,115,22,0.42)',
    display: 'inline-block',
    letterSpacing: '-0.2px',
    whiteSpace: 'nowrap',
  }

  const secondaryCTA: CSSProperties = {
    background: W,
    color: '#374151',
    padding: '13px 24px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    border: '1.5px solid #e2e8f0',
    display: 'inline-block',
  }

  const heroFeatures = [
    {
      icon: '💬',
      accentColor: '#25D366',
      accentBg: '#f0fdf4',
      accentBorder: '#86efac',
      title: 'WhatsApp & email alerts',
      badge: 'Most-loved feature',
      desc: 'Tasks due, approvals stuck, deadlines missed — alerts go straight to WhatsApp where your team already is. No app install needed.',
    },
    {
      icon: '🔁',
      accentColor: T,
      accentBg: '#f0fdfa',
      accentBorder: '#5eead4',
      title: 'Recurring tasks, automated',
      badge: 'Saves hours every week',
      desc: 'Set any task to repeat daily, weekly, monthly, or quarterly. Planora creates each instance, assigns it, and starts the clock automatically.',
    },
    {
      icon: '🧩',
      accentColor: P,
      accentBg: '#faf5ff',
      accentBorder: '#c4b5fd',
      title: 'Custom workflows for any team',
      badge: 'No-code workflow builder',
      desc: 'Build templates, approval chains, and custom fields for your exact process — no code required. Legal, ops, creative, finance, compliance.',
    },
  ]

  const secondaryFeatures = [
    {
      icon: '✅',
      title: 'Smart task management',
      desc: 'Assign, prioritise, bulk-complete. Filters by client, project, due date, or assignee.',
    },
    {
      icon: '✍️',
      title: 'Approval workflows',
      desc: 'Staff submit work for manager sign-off. Approve or return with one click. Audit trail included.',
    },
    {
      icon: '📈',
      title: 'Reports & time tracking',
      desc: 'Completion rates, billable hours, overdue trends. Filter by person, team, or 30/90-day windows.',
    },
  ]

  const useCases = [
    {
      icon: '🏛️',
      label: 'CA & Accounting firms',
      desc: '69 pre-built compliance tasks — GSTR, TDS, ITR, ROC. Auto-creates document subtasks.',
    },
    {
      icon: '🏢',
      label: 'Agencies & studios',
      desc: 'Manage client deliverables, approvals, and retainers in one workspace.',
    },
    {
      icon: '🏗️',
      label: 'Operations teams',
      desc: 'Recurring checklists, SOP enforcement, team performance dashboards.',
    },
    {
      icon: '📐',
      label: 'Legal & consulting',
      desc: 'Matter tracking, deadline alerts, document upload enforcement per task.',
    },
  ]

  const plans = [
    {
      name: 'Free',
      price: '0',
      color: '#64748b',
      bg: W,
      border: '#e2e8f0',
      badge: '',
      features: ['5 members', '3 projects', 'Unlimited tasks', 'WhatsApp alerts'],
      cta: 'Start free',
      primary: false,
    },
    {
      name: 'Starter',
      price: '999',
      color: T,
      bg: '#f0fdfa',
      border: '#99f6e4',
      badge: '',
      features: ['15 members', '15 projects', 'Time tracking', 'Recurring tasks', 'Approval workflow'],
      cta: 'Start free trial',
      primary: false,
    },
    {
      name: 'Pro',
      price: '2,999',
      color: F,
      bg: '#fff7ed',
      border: '#fed7aa',
      badge: '⭐ Best value',
      features: ['50 members', 'Unlimited projects', 'Custom modules', 'Advanced reports', 'API access', 'Priority support'],
      cta: 'Start free trial',
      primary: true,
    },
    {
      name: 'Business',
      price: '7,999',
      color: P,
      bg: '#faf5ff',
      border: '#ddd6fe',
      badge: '',
      features: ['Unlimited members', 'All Pro features', 'White-label', 'SSO / SAML', 'SLA guarantee', 'Dedicated manager'],
      cta: 'Contact us',
      primary: false,
    },
  ]

  const testimonials = [
    {
      name: 'Priya Sharma',
      title: 'Managing Partner',
      company: 'Sharma & Associates',
      location: 'Mumbai',
      quote: 'We replaced three separate tools with Planora. The recurring task automation alone saves us 4+ hours every single month-end.',
      metric: '4 hrs saved/month',
      metricColor: F,
      init: 'PS',
      color: F,
    },
    {
      name: 'Rahul Mehta',
      title: 'Founder & CEO',
      company: 'NexusDigital',
      location: 'Bengaluru',
      quote: 'WhatsApp reminders changed how our team operates. Task completion went from 67% to 94% within six weeks of switching to Planora.',
      metric: '67% → 94% completion',
      metricColor: T,
      init: 'RM',
      color: T,
    },
    {
      name: 'Anjali Nair',
      title: 'Head of Operations',
      company: 'Kochi Creative Studio',
      location: 'Kochi',
      quote: 'Client management, time tracking, and approvals all in one place. Setup took 20 minutes. We saw ROI in the first week.',
      metric: 'ROI in week 1',
      metricColor: P,
      init: 'AN',
      color: P,
    },
  ]

  const securityItems = [
    { icon: '🔐', title: 'End-to-end encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256).' },
    { icon: '🇮🇳', title: 'India data residency', desc: 'Your data stored in Indian data centres. Subject to Indian laws.' },
    { icon: '👥', title: 'Role-based access', desc: 'Granular permissions. Team members only see what they need.' },
    { icon: '📋', title: 'Full audit trail', desc: 'Every action logged. Know who did what and when.' },
    { icon: '🗑️', title: 'Your data, your control', desc: 'Export or delete all data at any time. No lock-in ever.' },
    { icon: '🛡️', title: 'DPDP Act aligned', desc: "Designed to comply with India's Digital Personal Data Protection Act." },
  ]

  const featureItems = [
    ...heroFeatures.map((f) => ({
      icon: f.icon,
      title: f.title,
      desc: f.desc,
      color: f.accentColor,
      bg: f.accentBg,
      border: f.accentBorder,
      badge: f.badge,
    })),
    ...secondaryFeatures.map((f) => ({
      icon: f.icon,
      title: f.title,
      desc: f.desc,
      color: '#64748b',
      bg: S,
      border: '#e2e8f0',
      badge: '',
    })),
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafaf9',
        colorScheme: 'light',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflowX: 'hidden',
        color: D,
      }}
    >
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          padding: '0 5%',
          height: 64,
          gap: 24,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: D, flexShrink: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: T,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: W,
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            P
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>Planora</span>
        </Link>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
          {[
            ['Features', '#features'],
            ['Solutions', '#solutions'],
            ['Pricing', '#pricing'],
          ].map(([l, h]) => (
            <a key={l} href={h} style={{ color: M, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
              {l}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/login" style={{ color: M, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
          <Link href="/login" style={{ ...primaryCTA, padding: '9px 22px', fontSize: 14, boxShadow: '0 3px 14px rgba(249,115,22,0.38)' }}>
            Start free trial →
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '44px 5% 36px', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 99,
              padding: '5px 14px',
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 13 }}>💬</span>
            <span style={{ color: '#15803d', fontSize: 12, fontWeight: 700 }}>WhatsApp alerts · INR billing · No USD ever</span>
          </div>

          <h1 style={{ fontSize: 'clamp(34px,5vw,56px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2.5px', margin: '0 0 18px' }}>
            Stop juggling tasks.
            <br />
            <span style={{ color: F }}>Start achieving goals.</span>
          </h1>

          <p style={{ fontSize: 17, color: M, lineHeight: 1.78, marginBottom: 32, maxWidth: 460 }}>
            The all-in-one workspace for modern Indian teams. Assign work, enforce deadlines, collect approvals, and get WhatsApp alerts — so nothing falls through the cracks.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <Link href="/login" style={{ ...primaryCTA, padding: '14px 32px', fontSize: 16, boxShadow: '0 6px 24px rgba(249,115,22,0.42)' }}>
              Start your free trial →
            </Link>
            <a href="#features" style={{ ...secondaryCTA, padding: '14px 22px', fontSize: 15 }}>
              See how it works
            </a>
          </div>

          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 28px', lineHeight: 1.6 }}>
            ✓ No credit card &nbsp;·&nbsp; ✓ Free for up to 5 people &nbsp;·&nbsp; ✓ Setup in 15 minutes
          </p>

          <div style={{ display: 'flex', gap: 28, paddingTop: 24, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {[
              ['200+', 'teams using Planora'],
              ['₹999', 'plans from /month'],
              ['4.9★', 'average rating'],
            ].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: 20, fontWeight: 800, color: D, letterSpacing: '-0.5px' }}>{v}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 320px', maxWidth: 500 }}>
          <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            <div style={{ background: S, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }} />
                ))}
              </div>
              <div style={{ flex: 1, background: W, border: '1px solid #e2e8f0', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>app.planora.in/dashboard</span>
              </div>
            </div>
            <div style={{ background: W, padding: 18 }}>
              <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fed7aa' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#ea580c', marginBottom: 3, fontWeight: 600 }}>Good morning, Rahul 👋</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>3 tasks due today</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: F }}>94%</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>completion rate</div>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Today&apos;s tasks
              </div>

              {[
                { done: true, title: 'Q3 client report — Acme', tag: '✓ Done', tb: '#dcfce7', tc: '#16a34a' },
                { done: false, title: 'Invoice approval pending', tag: 'Needs review', tb: '#fff7ed', tc: '#ea580c', hl: true },
                { done: false, title: 'Weekly ops checklist', tag: '🔁 Recurring', tb: '#ede9fe', tc: P },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 6, background: t.hl ? '#fff7ed' : S, border: t.hl ? '1px solid #fed7aa' : '1px solid #f1f5f9' }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: t.done ? T : 'transparent',
                      border: t.done ? 'none' : `2px solid ${t.hl ? F : '#cbd5e1'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.done && <span style={{ color: W, fontSize: 9, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.done ? '#94a3b8' : D, textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.title}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: t.tb, color: t.tc }}>
                    {t.tag}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>💬</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>WhatsApp reminder sent</div>
                  <div style={{ fontSize: 11, color: '#4ade80' }}>Rahul · Invoice approval due in 2 hrs</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                  <span style={{ color: '#94a3b8' }}>This week</span>
                  <span style={{ color: F, fontWeight: 700 }}>11 / 12 done</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: '91%', height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${T}, ${F})` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '18px 5%', background: S }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              ['200+', 'teams'],
              ['15k+', 'tasks done'],
              ['4.9★', 'rating'],
              ['99.9%', 'uptime'],
            ].map(([num, lbl]) => (
              <div key={lbl}>
                <div style={{ fontSize: 17, fontWeight: 800, color: F, letterSpacing: '-0.5px' }}>{num}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{lbl}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Used by</span>
            {['CA firms', 'Agencies', 'Startups', 'Legal teams'].map((s) => (
              <span key={s} style={{ fontSize: 11, fontWeight: 600, color: '#475569', background: W, border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 99 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 5% 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-block', background: '#fff7ed', color: F, fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #fed7aa', marginBottom: 16 }}>
            CORE FEATURES
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 12 }}>
            Built for teams who can&apos;t afford to miss deadlines
          </h2>
          <p style={{ fontSize: 16, color: M, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Three features your team will use every single day.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 0 }}>
          {featureItems.map((f, i) => (
            <div
              key={i}
              style={{
                background: W,
                border: '1px solid #f1f5f9',
                borderRadius: 16,
                padding: '24px',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {f.badge && (
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: 9,
                    fontWeight: 700,
                    color: f.color,
                    background: f.bg,
                    border: `1px solid ${f.border}`,
                    borderRadius: 99,
                    padding: '2px 10px',
                    marginBottom: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {f.badge}
                </div>
              )}
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px', color: D }}>{f.title}</h3>
              <p style={{ color: M, fontSize: 14, lineHeight: 1.68, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="solutions" style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: '#f0fdfa', color: T, fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #5eead4', marginBottom: 16 }}>
            WHO IT&apos;S FOR
          </div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>One platform, every team</h2>
          <p style={{ fontSize: 15, color: M, maxWidth: 420, margin: '0 auto' }}>Planora adapts to your workflow — not the other way around.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {useCases.map((u) => (
            <div key={u.label} style={{ background: S, border: '1px solid #f1f5f9', borderRadius: 16, padding: '24px 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{u.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: D }}>{u.label}</h3>
              <p style={{ fontSize: 13, color: M, lineHeight: 1.65, margin: 0 }}>{u.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)', padding: '72px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 22 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>🧩 Custom modules & integrations</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 900, color: W, letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.15 }}>
              Tailored to your unique workflow
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.68)', lineHeight: 1.75, marginBottom: 28, maxWidth: 420 }}>
              Every team works differently. Build custom task templates, define your own approval chains, create fields specific to your process, and connect Planora to your tools via API — no developers needed.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
              {['Custom fields', 'Custom approval chains', 'Task templates', 'API access', 'Role permissions'].map((tag) => (
                <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', padding: '4px 12px', borderRadius: 99 }}>
                  {tag}
                </span>
              ))}
            </div>

            <Link href="/login" style={{ background: F, color: W, padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(249,115,22,0.45)', display: 'inline-block' }}>
              Explore custom modules →
            </Link>
          </div>

          <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 16 }}>YOUR CUSTOM TASK TEMPLATE</div>
              {[
                { label: 'Client name', type: 'Text field', icon: '🔤' },
                { label: 'Due date', type: 'Date picker', icon: '📅' },
                { label: 'Invoice amount', type: 'Number field', icon: '💰' },
                { label: 'Approval required', type: 'Toggle · Approver', icon: '✍️' },
                { label: 'Document upload', type: 'File upload (required)', icon: '📎' },
              ].map((field) => (
                <div key={field.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginBottom: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 16 }}>{field.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: W }}>{field.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{field.type}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: `${F}22`, border: `1px solid ${F}44`, fontSize: 12, color: F, fontWeight: 700, textAlign: 'center' }}>
                + Add custom field
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: S, borderTop: '1px solid #f1f5f9', padding: '48px 5%' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 12 }}>
              {'★★★★★'.split('').map((s, i) => (
                <span key={i} style={{ color: '#fbbf24', fontSize: 22 }}>
                  {s}
                </span>
              ))}
            </div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 8 }}>Teams that made the switch</h2>
            <p style={{ fontSize: 14, color: '#94a3b8' }}>Real results from real teams across India</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 20 }}>
            {testimonials.map((t) => (
              <div key={t.name} style={{ background: W, border: '1px solid #f1f5f9', borderRadius: 18, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} style={{ color: '#fbbf24', fontSize: 14 }}>
                      {s}
                    </span>
                  ))}
                </div>

                <div style={{ background: `${t.metricColor}12`, border: `1px solid ${t.metricColor}30`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, alignSelf: 'flex-start' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.metricColor }}>{t.metric}</span>
                </div>

                <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.75, marginBottom: 20, fontStyle: 'italic', flex: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 18, borderTop: '1px solid #f8fafc' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: W, fontSize: 13, fontWeight: 800, flexShrink: 0, boxShadow: `0 4px 12px ${t.color}40` }}>
                    {t.init}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: D }}>{t.name}</p>
                    <p style={{ color: M, fontSize: 12, margin: '2px 0 0' }}>
                      {t.title} · {t.company}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '1px 0 0' }}>📍 {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="pricing" style={{ maxWidth: 1060, margin: '0 auto', padding: '52px 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ display: 'inline-block', background: '#fff7ed', color: F, fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #fed7aa', marginBottom: 16 }}>
            SIMPLE PRICING
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 10 }}>No USD. No surprises.</h2>
          <p style={{ fontSize: 16, color: M, marginBottom: 8 }}>Start free. Upgrade when you&apos;re ready. All prices in INR.</p>
          <p style={{ fontSize: 13, color: T, fontWeight: 700 }}>💡 Annual billing saves 20% — use a coupon code at checkout</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {plans.map((p) => (
            <div key={p.name} style={{ background: p.bg, border: `2px solid ${p.primary ? p.color : p.border}`, borderRadius: 18, padding: '28px 20px', position: 'relative', boxShadow: p.primary ? `0 12px 40px ${p.color}22` : '0 2px 8px rgba(0,0,0,0.04)' }}>
              {p.badge && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: F, color: W, fontSize: 11, fontWeight: 800, padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(249,115,22,0.4)' }}>
                  {p.badge}
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 800, color: p.color, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>₹</span>
                <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', color: D }}>{p.price}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>/mo</span>
              </div>

              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18 }}>No credit card required</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                    <span style={{ color: p.color, fontWeight: 800, fontSize: 12, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '11px',
                  borderRadius: 10,
                  background: p.primary ? F : W,
                  color: p.primary ? W : '#374151',
                  border: p.primary ? 'none' : '1.5px solid #e2e8f0',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: p.primary ? '0 4px 16px rgba(249,115,22,0.38)' : 'none',
                }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 24 }}>Billed via Razorpay · Cancel anytime · INR only · Annual saves 20%</p>
      </div>

      <div style={{ background: '#0f172a', padding: '72px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 99, padding: '5px 16px', marginBottom: 20 }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2dd4bf' }}>Security & privacy</span>
            </div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, color: W, letterSpacing: '-1px', marginBottom: 12 }}>Your data stays yours</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
              Built with enterprise-grade security from day one. Encrypted, isolated, and never shared.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {securityItems.map((item) => (
              <div key={item.title} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '22px 18px' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: W, marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: T, padding: '52px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 900, color: W, letterSpacing: '-1px', marginBottom: 12, lineHeight: 1.15 }}>
            Ready to stop chasing your team?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 32, lineHeight: 1.65 }}>
            Join 200+ Indian teams using Planora to get more done. Free to start. No credit card. Setup in 15 minutes.
          </p>
          <Link href="/login" style={{ ...primaryCTA, padding: '16px 40px', fontSize: 17, boxShadow: '0 8px 28px rgba(249,115,22,0.5)', marginBottom: 16 }}>
            Create your free workspace →
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 14 }}>
            Free forever for up to 5 people · No credit card · Made in India 🇮🇳
          </p>
        </div>
      </div>

      <footer style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', color: W, fontWeight: 800, fontSize: 13 }}>
            P
          </div>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Planora · Made in India 🇮🇳</span>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {[
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ].map(([l, h]) => (
            <Link key={l} href={h} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>
              {l}
            </Link>
          ))}
          <a href="mailto:support@sngadvisers.com" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>
            Contact
          </a>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0 }}>© 2026 SNG Advisers. All rights reserved.</p>
      </footer>
    </div>
  )
}