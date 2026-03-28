import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'

// ─── REDESIGNED: Clean white + orange + teal light theme ───────────────────

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  const F = '#f97316'   // orange accent
  const T = '#0d9488'   // teal accent
  const D = '#111827'   // dark text
  const M = '#6b7280'   // muted text
  const S = '#f9fafb'   // subtle bg


  const features = [
    { icon: '✅', title: 'Smart task management', desc: 'Create, assign, and complete tasks in seconds. Bulk actions, priorities, client filters, and due dates.' },
    { icon: '🔁', title: 'Recurring tasks', desc: 'Auto-spawn tasks daily, weekly, or monthly. Set it once — Planora handles the rest forever.' },
    { icon: '🏛️', title: 'CA compliance built-in', desc: '69 pre-built GST, TDS, ITR, and ROC tasks. Each auto-creates required document subtasks with upload enforcement.' },
    { icon: '🔔', title: 'Smart reminders', desc: 'Email + WhatsApp alerts when tasks are due. Automatic escalation to managers after 1 day of delay.' },
    { icon: '✍️', title: 'Approval workflows', desc: 'Staff submit completed work for manager review. Approve or return with one click. Full audit trail.' },
    { icon: '📈', title: 'Performance reports', desc: 'Employee completion rates, on-time delivery, and hours logged. Filter by client or 30/60/90 day windows.' },
  ]

  const plans = [
    { name: 'Free', price: '0', color: '#64748b', bg: '#f9fafb', border: '#e5e7eb', features: ['Up to 5 members', '3 projects', 'Unlimited tasks', 'Basic reports'], cta: 'Start free', primary: false },
    { name: 'Starter', price: '999', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', features: ['Up to 15 members', '15 projects', 'Time tracking', 'Recurring tasks', 'Approval workflow'], cta: 'Get Starter', primary: false },
    { name: 'Pro', price: '2,999', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', features: ['Up to 50 members', 'Unlimited projects', 'CA compliance tools', 'Custom fields', 'Role permissions', 'Advanced reports'], cta: 'Get Pro', primary: true },
    { name: 'Business', price: '7,999', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', features: ['Unlimited members', 'All Pro features', 'White-label', 'SSO / SAML', 'SLA guarantee', 'Dedicated support'], cta: 'Contact us', primary: false },
  ]

  const testimonials = [
    { name: 'Priya Sharma', role: 'CA Firm Owner, Mumbai', quote: 'Replaced three tools with Planora. The compliance task automation saves 4 hours every month-end.', init: 'PS', color: F },
    { name: 'Rahul Mehta', role: 'Startup Founder, Bengaluru', quote: 'Finally a PM tool built for how Indian teams work. Razorpay billing, WhatsApp alerts — exactly what we needed.', init: 'RM', color: T },
    { name: 'Anjali Nair', role: 'Agency Head, Kochi', quote: 'Client management and time tracking in one place. Setup took 20 minutes. ROI in the first week.', init: 'AN', color: '#7c3aed' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fff', colorScheme: 'light', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: 'hidden', color: D }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', padding: '0 5%', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>Planora</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 36 }}>
          {[['Features','#features'],['For CA firms','#ca'],['Pricing','#pricing']].map(([l,h]) => (
            <a key={l} href={h} style={{ color: M, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/login" style={{ color: M, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          <Link href="/login" style={{ background: F, color: '#fff', padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '72px 5% 56px', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '5px 14px', marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: F, display: 'inline-block' }}/>
            <span style={{ color: '#ea580c', fontSize: 13, fontWeight: 600 }}>Built for Indian teams · CA & startup ready</span>
          </div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,56px)', fontWeight: 900, lineHeight: 1.06, letterSpacing: '-2px', marginBottom: 20 }}>
            Your team&apos;s work,<br/><span style={{ color: F }}>finally organised</span>
          </h1>
          <p style={{ fontSize: 17, color: M, lineHeight: 1.75, marginBottom: 36, maxWidth: 440 }}>
            Tasks, compliance deadlines, approvals, and time tracking — in one clean workspace. Built for CA firms and growing Indian teams.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 44 }}>
            <Link href="/login" style={{ background: F, color: '#fff', padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 22px rgba(249,115,22,0.38)', display: 'inline-block' }}>
              Start for free →
            </Link>
            <a href="#features" style={{ background: S, color: '#374151', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid #e5e7eb', display: 'inline-block' }}>
              See features
            </a>
          </div>
          <div style={{ display: 'flex', gap: 32, paddingTop: 28, borderTop: '1px solid #f3f4f6' }}>
            {[['₹999','/month'],['Free','to start'],['INR','billing'],['No','credit card']].map(([v,l]) => (
              <div key={l}>
                <div style={{ fontSize: 20, fontWeight: 800, color: v === '₹999' ? F : D }}>{v}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* App mockup */}
        <div style={{ flex: '1 1 320px', maxWidth: 500 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
            <div style={{ background: S, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }}/>)}
              </div>
              <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>planora.app/dashboard</span>
              </div>
            </div>
            <div style={{ background: '#fff', padding: 18 }}>
              <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fed7aa' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#ea580c', marginBottom: 3, fontWeight: 600 }}>Good morning, Sachit 👋</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>3 tasks due today</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: F }}>78%</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>completion</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Today</div>
              {[
                { done: true,  title: 'GSTR 3B — Acme Corp', tag: 'Done', tb: '#dcfce7', tc: '#16a34a' },
                { done: false, title: 'TDS return filing', tag: 'Due today', tb: '#fff7ed', tc: '#ea580c', hl: true },
                { done: false, title: 'Balance sheet review', tag: '🔁 Recurring', tb: '#ede9fe', tc: '#7c3aed' },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 6, background: t.hl ? '#fff7ed' : S, border: t.hl ? '1px solid #fed7aa' : '1px solid #f3f4f6' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: t.done ? T : 'transparent', border: t.done ? 'none' : `2px solid ${t.hl ? F : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.done && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.done ? '#9ca3af' : D, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: t.tb, color: t.tc }}>{t.tag}</span>
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                  <span style={{ color: '#9ca3af' }}>This week</span>
                  <span style={{ color: F, fontWeight: 700 }}>8 / 12 done</span>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: '66%', height: '100%', borderRadius: 99, background: F }}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CA FIRMS */}
      <div id="ca" style={{ background: '#fff7ed', borderTop: '1px solid #fed7aa', borderBottom: '1px solid #fed7aa', padding: '60px 5%' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #fed7aa', borderRadius: 99, padding: '4px 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 14 }}>🏛️</span>
              <span style={{ fontSize: 12, color: '#ea580c', fontWeight: 700 }}>Built for CA firms</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>Every compliance deadline, on autopilot</h2>
            <p style={{ fontSize: 15, color: M, lineHeight: 1.7, marginBottom: 20 }}>
              69 pre-built tasks — GSTR, TDS, ITR, ROC, PF, ESI, and more. Each task auto-creates the required document subtasks. Staff cannot mark complete without uploading the actual file.
            </p>
            <Link href="/login" style={{ display: 'inline-block', background: F, color: '#fff', padding: '11px 24px', borderRadius: 9, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Try it free →
            </Link>
          </div>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { task: 'GSTR 3B (Monthly)', sub: 'Computation', ok: false },
              { task: 'TDS 26Q Return', sub: 'Computation', ok: true },
              { task: 'ROC Form 11', sub: 'Form Signed & Filed', ok: false },
            ].map(t => (
              <div key={t.task} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #fed7aa', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{t.task}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: M }}>📎 {t.sub}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.ok ? '#16a34a' : F }}>{t.ok ? '✓ Uploaded' : '↑ Upload required'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 10 }}>Everything your team needs</h2>
          <p style={{ fontSize: 15, color: M, maxWidth: 440, margin: '0 auto' }}>Six powerful features that replace a stack of disconnected tools.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: S, border: '1px solid #f3f4f6', borderRadius: 16, padding: '28px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: M, fontSize: 13, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div style={{ background: S, borderTop: '1px solid #f3f4f6', padding: '64px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>Loved by Indian teams</h2>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>From CA practices to growing startups</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {testimonials.map(t => (
              <div key={t.name} style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.75, marginBottom: 16, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{t.init}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{t.name}</p>
                    <p style={{ color: '#9ca3af', fontSize: 11, margin: '2px 0 0' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ maxWidth: 1000, margin: '0 auto', padding: '80px 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 10 }}>No USD. No surprises.</h2>
          <p style={{ fontSize: 15, color: M }}>Start free. Upgrade when your team grows. All prices in INR.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: p.bg, border: `2px solid ${p.primary ? p.color : p.border}`, borderRadius: 16, padding: '24px 18px', position: 'relative', boxShadow: p.primary ? '0 8px 28px rgba(249,115,22,0.15)' : 'none' }}>
              {p.primary && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: F, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 99, whiteSpace: 'nowrap' }}>Most popular</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 18 }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>₹</span>
                <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-1px' }}>{p.price}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>/mo</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151' }}>
                    <span style={{ color: p.color, fontWeight: 700, fontSize: 11 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 9, background: p.primary ? F : '#fff', color: p.primary ? '#fff' : '#374151', border: p.primary ? 'none' : '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 22 }}>Billed via Razorpay · Cancel anytime · Annual billing saves 20%</p>
      </div>

      {/* CTA */}
      <div style={{ background: T, padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 10 }}>Ready to get organised?</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>Free to start. No setup fee. No USD. Made in India. 🇮🇳</p>
          <Link href="/login" style={{ display: 'inline-block', background: '#fff', color: T, padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
            Create your workspace free →
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12 }}>Free forever for teams up to 5 people</p>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: S, borderTop: '1px solid #f3f4f6', padding: '24px 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>P</div>
          <span style={{ color: M, fontSize: 13 }}>Planora · Made in India 🇮🇳</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/privacy" style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms"   style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>Terms</Link>
          <a href="mailto:support@sngadvisers.com" style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>Contact</a>
        </div>
        <p style={{ color: '#d1d5db', fontSize: 12, margin: 0 }}>© 2026 SNG Advisers</p>
      </footer>
    </div>
  )
}
