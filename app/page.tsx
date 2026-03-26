import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif", overflowX: 'hidden' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center',
        padding: '0 48px', height: 64, borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0d9488,#0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>P</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Planora</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
          {['Features','Pricing','Demo','Blog'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textDecoration: 'none' }} className="landing-nav-link">{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 14px rgba(13,148,136,0.4)' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero — two-column interactive ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 60px', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>

        {/* Left */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.35)', borderRadius: 99, padding: '5px 14px', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }}/>
            <span style={{ color: '#5eead4', fontSize: 13, fontWeight: 500 }}>Built for Indian teams · Razorpay · WhatsApp</span>
          </div>
          <h1 style={{ fontSize: 'clamp(36px,5vw,58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 20, color: '#fff' }}>
            Your team's work,<br/>
            <span style={{ background: 'linear-gradient(90deg,#0d9488,#0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>finally organised</span>
          </h1>
          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.7, marginBottom: 32, maxWidth: 460 }}>
            Manage projects, track time, automate recurring tasks, and get WhatsApp reminders — all in one beautiful workspace.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 24px rgba(13,148,136,0.45)', display: 'inline-block' }}>
              Start for free →
            </Link>
            <a href="#demo" style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.15)', display: 'inline-block' }}>
              ▶ See demo
            </a>
          </div>
          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 28, paddingTop: 24, borderTop: '1px solid #1f2937' }}>
            {[['₹999', '/month'], ['Free', 'to start'], ['INR', 'billing'], ['No', 'credit card']].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: 20, fontWeight: 800, color: v === '₹999' ? '#0d9488' : '#fff' }}>{v}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — app mockup */}
        <div style={{ flex: 1, minWidth: 280, maxWidth: 520 }}>
          {/* Browser chrome */}
          <div style={{ background: '#1f2937', borderRadius: '14px 14px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #374151', borderBottom: 'none' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }}/>)}
            </div>
            <div style={{ flex: 1, background: '#374151', borderRadius: 5, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>sng-adwisers.com/dashboard</span>
            </div>
          </div>
          <div style={{ background: '#111827', borderRadius: '0 0 14px 14px', padding: 18, border: '1px solid #1f2937' }}>
            {/* Greeting bar */}
            <div style={{ background: 'linear-gradient(90deg,#0f2926,#1a1040)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#5eead4', marginBottom: 3 }}>Good morning, Saksham 👋</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>3 tasks due today</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0d9488' }}>78%</div>
                <div style={{ fontSize: 10, color: '#475569' }}>completion</div>
              </div>
            </div>
            {/* Tasks */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Today</div>
            {[
              { done: true,  title: 'Client onboarding — Acme', tag: 'Done', tagBg: '#14532d', tagClr: '#4ade80' },
              { done: false, title: 'Q3 audit filing', tag: 'Today', tagBg: '#134e4a', tagClr: '#5eead4', highlight: true },
              { done: false, title: 'GST return review', tag: '🔁 Recurring', tagBg: '#4c1d95', tagClr: '#c4b5fd' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                background: t.highlight ? 'rgba(13,148,136,0.06)' : '#1e2d3d',
                border: t.highlight ? '1px solid rgba(13,148,136,0.3)' : '1px solid transparent' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: t.done ? '#0d9488' : 'transparent',
                  border: t.done ? 'none' : `2px solid ${t.highlight ? '#0d9488' : '#334155'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.done && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.done ? '#475569' : '#f1f5f9', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: t.tagBg, color: t.tagClr }}>{t.tag}</span>
              </div>
            ))}
            {/* Progress */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: '#475569' }}>This week</span>
                <span style={{ color: '#0d9488', fontWeight: 600 }}>8 / 12 done</span>
              </div>
              <div style={{ background: '#1f2937', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{ width: '66%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#0d9488,#0891b2)' }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Demo / Animated features section ── */}
      <div id="demo" style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 99, marginBottom: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <span style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>See it in action</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 12 }}>Everything your team needs</h2>
          <p style={{ fontSize: 15, color: '#475569', maxWidth: 480, margin: '0 auto' }}>Six powerful features that replace a stack of disconnected tools.</p>
        </div>

        {/* Feature demo cards — animated CSS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
          {[
            {
              icon: '✅', color: '#0d9488', bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.2)',
              title: 'Smart task management',
              desc: 'Create tasks in seconds. Set priorities, due dates, assignees. Bulk complete. Filter by anything.',
              demo: 'tasks',
            },
            {
              icon: '🔁', color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)',
              title: 'Recurring tasks',
              desc: 'Every Monday, 1st of month, quarterly — tasks auto-spawn on schedule without manual effort.',
              demo: 'recurring',
            },
            {
              icon: '🔔', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.2)',
              title: 'WhatsApp & email alerts',
              desc: 'Get nudged when tasks are overdue or due soon. No app install needed — just a message.',
              demo: 'alerts',
            },
            {
              icon: '⏱', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.2)',
              title: 'Time tracking',
              desc: 'Log billable and non-billable hours per project. Generate reports. Know where your time goes.',
              demo: 'time',
            },
            {
              icon: '📊', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)',
              title: 'Kanban boards',
              desc: 'Switch between list and board view. Drag tasks across To do / In progress / Review / Done.',
              demo: 'kanban',
            },
            {
              icon: '📈', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)',
              title: 'Performance reports',
              desc: 'Track completion rates per employee. 30/60/90 day timelines. Role-based visibility.',
              demo: 'reports',
            },
          ].map(f => (
            <div key={f.title} style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: 16, padding: '24px 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.65, marginBottom: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing ── */}
      <div id="pricing" style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 99, marginBottom: 14, background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)' }}>
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>Simple pricing · Pay in INR</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 12 }}>No USD. No surprises.</h2>
          <p style={{ fontSize: 15, color: '#475569' }}>Start free. Upgrade when your team grows.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            {
              name: 'Free', price: '0', unit: '/month', color: '#64748b',
              features: ['Up to 5 members', '3 projects', 'Unlimited tasks', 'Basic reports', '5 GB storage'],
              cta: 'Start free', ctaBg: '#1e293b', ctaColor: '#94a3b8',
            },
            {
              name: 'Starter', price: '999', unit: '/month', color: '#0d9488',
              features: ['Up to 15 members', '15 projects', 'Time tracking', 'Recurring tasks', 'Approval workflow', '20 GB storage', 'Priority support'],
              cta: 'Start Starter', ctaBg: '#0d9488', ctaColor: '#fff',
            },
            {
              name: 'Pro', price: '2,999', unit: '/month', color: '#7c3aed', popular: true,
              features: ['Up to 50 members', 'Unlimited projects', 'Advanced reports', 'Custom task fields', 'Role permissions', 'API access', '100 GB storage'],
              cta: 'Start Pro', ctaBg: '#7c3aed', ctaColor: '#fff',
            },
            {
              name: 'Business', price: '7,999', unit: '/month', color: '#0891b2',
              features: ['Unlimited members', 'All Pro features', 'White-label branding', 'SSO / SAML', 'SLA guarantee', 'Dedicated support', 'Unlimited storage'],
              cta: 'Contact us', ctaBg: '#0891b2', ctaColor: '#fff',
            },
          ].map(p => (
            <div key={p.name} style={{ background: p.popular ? 'rgba(124,58,237,0.1)' : '#111827', border: `1px solid ${p.popular ? 'rgba(124,58,237,0.5)' : '#1f2937'}`, borderRadius: 16, padding: '24px 20px', position: 'relative' }}>
              {p.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  Most popular
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.color, marginBottom: 6 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>₹</span>
                  <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>{p.price}</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{p.unit}</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ color: p.color, fontSize: 10 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 9, background: p.ctaBg, color: p.ctaColor, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#334155', marginTop: 24 }}>
          All prices in INR · Billed via Razorpay · Cancel anytime · Annual billing saves 20%
        </p>
      </div>

      {/* ── Social proof ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
          {[
            { name: 'Priya Sharma', role: 'CA Firm Owner, Mumbai', quote: 'Replaced three tools with Planora. The WhatsApp reminders alone saved us from missing deadlines.', avatar: 'PS', color: '#7c3aed' },
            { name: 'Rahul Mehta',  role: 'Startup Founder, Bengaluru', quote: 'Finally a PM tool built for how Indian teams work. Razorpay billing is a massive relief.', avatar: 'RM', color: '#0d9488' },
            { name: 'Anjali Nair',  role: 'Agency Head, Kochi', quote: 'Client management and time tracking are exactly what we needed. Setup took 20 minutes.', avatar: 'AN', color: '#ea580c' },
          ].map(t => (
            <div key={t.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 18px' }}>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7, marginBottom: 14, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{t.avatar}</div>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 580, margin: '0 auto', background: 'linear-gradient(135deg, rgba(13,148,136,0.12), rgba(124,58,237,0.10))', border: '1px solid rgba(13,148,136,0.22)', borderRadius: 24, padding: '52px 36px' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🚀</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 10 }}>Ready to get organised?</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>Free to start. No setup fee. No USD. No hidden costs.</p>
          <Link href="/login" style={{ display: 'inline-block', background: '#0d9488', color: '#fff', padding: '14px 34px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 28px rgba(13,148,136,0.4)' }}>
            Create your workspace free →
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 12 }}>Free forever for teams up to 5 people</p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '28px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>P</div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Planora · Made in India 🇮🇳</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy','Terms','Contact'].map(l => (
            <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>© 2025 SNG Advisors</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .landing-nav-link:hover { color: #fff !important }
      `}}/>
    </div>
  )
}