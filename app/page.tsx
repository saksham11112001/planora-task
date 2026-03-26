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

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center',
        padding: '0 48px', height: 64, borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0d9488,#0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>P</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Planora</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
          {['Features','Pricing','Clients','Blog'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14,
              textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.target as any).style.color = '#fff'}
              onMouseLeave={e => (e.target as any).style.color = 'rgba(255,255,255,0.55)'}>
              {l}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '8px 20px',
            borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(13,148,136,0.4)' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden' }}>
        {/* Gradient orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.15) 0%, transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: '20%', right: '10%', width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32,
          padding: '6px 16px', borderRadius: 99,
          background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.35)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9488', display: 'inline-block', animation: 'pulse 2s infinite' }}/>
          <span style={{ color: '#5eead4', fontSize: 13, fontWeight: 500 }}>
            Built for Indian teams · Razorpay · WhatsApp reminders
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.08,
          letterSpacing: '-2px', marginBottom: 24, maxWidth: 860, margin: '0 auto 24px' }}>
          <span style={{ color: '#fff' }}>Your team's work,</span><br/>
          <span style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            finally organised
          </span>
        </h1>

        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
          maxWidth: 520, margin: '0 auto 44px' }}>
          Manage projects, track time, automate recurring tasks, and get WhatsApp reminders — all in one beautiful workspace.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#0d9488', color: '#fff', padding: '14px 32px', borderRadius: 10,
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(13,148,136,0.45)', transition: 'all 0.15s' }}>
            Start for free →
          </Link>
          <a href="#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', color: '#fff', padding: '14px 32px', borderRadius: 10,
            fontSize: 16, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.15)' }}>
            ▶ Watch demo
          </a>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13 }}>No credit card required · Free forever for small teams</p>

        {/* ── App screenshot mockup ── */}
        <div style={{ maxWidth: 980, margin: '60px auto 0', position: 'relative' }}>
          {/* Glow behind */}
          <div style={{ position: 'absolute', inset: '-30px', background: 'radial-gradient(ellipse at center, rgba(13,148,136,0.12) 0%, transparent 70%)', borderRadius: 30, pointerEvents: 'none' }}/>

          <div style={{ background: '#111827', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.6)', position: 'relative' }}>
            {/* Browser chrome */}
            <div style={{ background: '#1f2937', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }}/>
                ))}
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 12px',
                fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                sng-advisers.planora.app/dashboard
              </div>
            </div>

            {/* App UI mockup */}
            <div style={{ display: 'flex', height: 460 }}>
              {/* Sidebar */}
              <div style={{ width: 200, background: '#0a0f1a', padding: '16px 10px',
                borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '0 4px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0d9488',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>P</div>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>SNG Advisers</span>
                </div>
                {[
                  { label: 'Home', dot: '#0d9488', active: true },
                  { label: 'My tasks', dot: null, active: false },
                  { label: 'Projects', dot: null, active: false },
                  { label: 'Clients', dot: null, active: false },
                  { label: 'Calendar', dot: null, active: false },
                  { label: 'Reports', dot: null, active: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 6, marginBottom: 2,
                    background: item.active ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%',
                      background: item.dot ?? 'rgba(255,255,255,0.2)' }}/>
                    <span style={{ fontSize: 12, color: item.active ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: item.active ? 500 : 400 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: '10px', background: 'rgba(13,148,136,0.15)',
                  borderRadius: 8, border: '1px solid rgba(13,148,136,0.3)' }}>
                  <div style={{ fontSize: 10, color: '#5eead4', fontWeight: 600, marginBottom: 3 }}>14 days left in trial</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Upgrade to Pro →</div>
                </div>
              </div>

              {/* Main content */}
              <div style={{ flex: 1, background: '#111827', padding: '20px 24px', overflowY: 'auto' }}>
                {/* Hero banner in mockup */}
                <div style={{ background: 'linear-gradient(135deg, #0f2926, #1a1040)', borderRadius: 12,
                  padding: '16px 20px', marginBottom: 16, border: '1px solid rgba(13,148,136,0.2)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Good morning 👋</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Welcome back, Saksham!</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['New task','New project','Calendar'].map((btn, i) => (
                      <div key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: i === 0 ? '#0d9488' : 'rgba(255,255,255,0.1)',
                        color: i === 0 ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                        {btn}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Overdue', val: '3', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
                    { label: 'Due today', val: '5', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
                    { label: 'Completed', val: '12', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
                    { label: 'Rate', val: '78%', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: k.bg, borderRadius: 8, padding: '10px 12px',
                      border: `1px solid ${k.color}22` }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Task list */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>My tasks</div>
                  {[
                    { title: 'Website copy review', proj: 'Website Redesign', color: '#6366f1', done: false, tag: 'High' },
                    { title: 'Send Q3 report',      proj: 'Acme Corp',         color: '#0d9488', done: false, tag: 'Today' },
                    { title: 'Competitor analysis', proj: 'One-time',          color: '#64748b', done: true,  tag: '' },
                  ].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                        background: t.done ? '#0d9488' : 'transparent',
                        border: t.done ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: t.done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                          textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <div style={{ width: 5, height: 5, borderRadius: 1, background: t.color }}/>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{t.proj}</span>
                        </div>
                      </div>
                      {t.tag && <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                        background: t.tag === 'Today' ? 'rgba(13,148,136,0.2)' : 'rgba(234,88,12,0.2)',
                        color: t.tag === 'Today' ? '#5eead4' : '#fb923c', fontWeight: 600 }}>{t.tag}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Social proof ─────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 16 }}>Trusted by teams across India</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {['CA firms','Startups','Agencies','Consultants','Law firms'].map(t => (
            <span key={t} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────── */}
      <div id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 99, marginBottom: 16,
            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <span style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>Everything you need</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff',
            letterSpacing: '-1px', marginBottom: 14 }}>One platform. All your work.</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto' }}>
            Stop juggling spreadsheets, WhatsApp groups, and sticky notes. Planora brings it all together.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {[
            {
              icon: '✅', color: '#0d9488', bg: 'rgba(13,148,136,0.1)', border: 'rgba(13,148,136,0.25)',
              title: 'Smart task management',
              desc: 'Create tasks in seconds with priorities, due dates, assignees and subtasks. Bulk complete. Filter by anything.',
              tags: ['Subtasks','Priorities','Bulk actions'],
            },
            {
              icon: '📊', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)',
              title: 'Kanban & list views',
              desc: 'Switch between list and board view per project. Drag tasks across columns. See progress at a glance.',
              tags: ['Board view','List view','Progress'],
            },
            {
              icon: '🔁', color: '#ea580c', bg: 'rgba(234,88,12,0.1)', border: 'rgba(234,88,12,0.25)',
              title: 'Recurring tasks',
              desc: 'Set tasks to repeat every Monday, 1st of month, quarterly — they auto-spawn without manual effort.',
              tags: ['Daily','Weekly','Monthly'],
            },
            {
              icon: '⏱', color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)',
              title: 'Time tracking',
              desc: 'Log billable and non-billable hours per project. Generate reports. Know where your time goes.',
              tags: ['Billable','Reports','Per project'],
            },
            {
              icon: '🔔', color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', border: 'rgba(202,138,4,0.25)',
              title: 'WhatsApp reminders',
              desc: 'Get nudged on WhatsApp when tasks are overdue or due soon. No app required — just a message.',
              tags: ['WhatsApp','Overdue alerts','Due soon'],
            },
            {
              icon: '📈', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.25)',
              title: 'Employee performance',
              desc: 'Track completion rates, on-time delivery, overdue tasks per team member. 30/60/90 day timelines.',
              tags: ['Analytics','Per employee','Timelines'],
            },
          ].map(f => (
            <div key={f.title} style={{ background: f.bg, border: `1px solid ${f.border}`,
              borderRadius: 16, padding: '24px 22px', transition: 'transform 0.15s' }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.65, marginBottom: 14 }}>{f.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {f.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99,
                    background: `${f.color}20`, color: f.color, fontWeight: 600, border: `1px solid ${f.color}30` }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <div style={{ padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            { name: 'Priya Sharma', role: 'CA Firm Owner, Mumbai', quote: 'We replaced three tools with Planora. The WhatsApp reminders alone saved us from missing deadlines.', avatar: 'PS', color: '#7c3aed' },
            { name: 'Rahul Mehta', role: 'Startup Founder, Bengaluru', quote: "Finally a project management tool that's actually built for how Indian teams work. The Razorpay billing is a relief.", avatar: 'RM', color: '#0d9488' },
            { name: 'Anjali Nair', role: 'Agency Head, Kochi', quote: 'The client management and time tracking are exactly what our agency needed. Setup took 20 minutes.', avatar: 'AN', color: '#ea580c' },
          ].map(t => (
            <div key={t.name} style={{ background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic' }}>
                "{t.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{t.avatar}</div>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing CTA ───────────────────────────────────────────── */}
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', background: 'linear-gradient(135deg, rgba(13,148,136,0.15), rgba(124,58,237,0.12))',
          border: '1px solid rgba(13,148,136,0.25)', borderRadius: 24, padding: '56px 40px' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Ready to get organised?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>
            Start free. Upgrade when you need to. No setup fee, no hidden costs, no USD.
          </p>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#0d9488', color: '#fff', padding: '15px 36px', borderRadius: 10,
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 8px 28px rgba(13,148,136,0.4)' }}>
            Create your workspace free →
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, marginTop: 14 }}>
            Free forever for teams up to 5 people
          </p>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '32px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#0d9488',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>P</div>
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
        a:hover{opacity:0.85}
      `}}/>
    </div>
  )
}
