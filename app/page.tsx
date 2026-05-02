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
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden',
      color: '#0f172a',
      colorScheme: 'light',
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Animations: minimal — only what earns its weight ── */
        @keyframes shimmer {
          0%   { background-position: 200% center }
          100% { background-position: -200% center }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(18px) }
          to   { opacity: 1; transform: translateY(0) }
        }

        .fade-up   { animation: fade-up 0.55s ease both }
        .fade-up-2 { animation: fade-up 0.55s 0.1s ease both }
        .fade-up-3 { animation: fade-up 0.55s 0.2s ease both }

        /* ── Interactive states ── */
        .btn-primary { transition: transform 0.18s ease, box-shadow 0.18s ease !important }
        .btn-primary:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 14px 36px rgba(249,115,22,0.45) !important;
        }
        .btn-ghost { transition: background 0.15s ease !important }
        .btn-ghost:hover { background: rgba(255,255,255,0.14) !important }

        .nav-link { transition: color 0.14s }
        .nav-link:hover { color: #0d9488 !important }

        .card-lift { transition: transform 0.2s ease, box-shadow 0.2s ease }
        .card-lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.1) !important;
        }

        .footer-link { transition: color 0.14s }
        .footer-link:hover { color: rgba(255,255,255,0.75) !important }

        .faq-details summary { cursor: pointer; list-style: none; user-select: none }
        .faq-details summary::-webkit-details-marker { display: none }
        .faq-details[open] summary .faq-icon { transform: rotate(45deg) }
        .faq-icon { transition: transform 0.2s ease; display: inline-block }

        /* ── Responsive ── */
        @media (max-width: 960px) {
          .hero-cols { flex-direction: column !important }
          .hero-visual { display: none !important }
          .grid-3 { grid-template-columns: 1fr !important }
          .grid-4 { grid-template-columns: 1fr 1fr !important }
          .grid-2 { grid-template-columns: 1fr !important }
          .pricing-grid { grid-template-columns: 1fr !important }
          .footer-grid { grid-template-columns: 1fr 1fr !important }
        }
        @media (max-width: 640px) {
          .nav-mid { display: none !important }
          .grid-4 { grid-template-columns: 1fr !important }
          .footer-grid { grid-template-columns: 1fr !important }
          .stats-row { flex-wrap: wrap !important; gap: 20px !important }
          .steps-row { grid-template-columns: 1fr !important }
          .step-connector { display: none !important }
        }
      `}</style>

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', padding: '0 6%', height: 64, gap: 32,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8l3 3 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px', color: '#0f172a' }}>Taska</span>
        </Link>

        <div className="nav-mid" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 28 }}>
          {[['Features','#features'],['Solutions','#solutions'],['Pricing','#pricing'],['Compare','#compare']].map(([l,h]) => (
            <a key={l} href={h} className="nav-link"
              style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Link href="/login" className="nav-link"
            style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
          <Link href="/login" className="btn-primary"
            style={{
              background: '#0d9488', color: '#fff', padding: '9px 20px', borderRadius: 9,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(13,148,136,0.28)', display: 'inline-block',
            }}>
            Start free →
          </Link>
        </div>
      </nav>

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        background: 'linear-gradient(170deg, #0a0f1e 0%, #0c1a32 55%, #0a1224 100%)',
        padding: '88px 6% 0', position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(13,148,136,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(13,148,136,0.07) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          pointerEvents: 'none',
        }}/>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -100, left: '22%', width: 640, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.13) 0%, transparent 68%)',
          pointerEvents: 'none',
        }}/>

        <div
          className="hero-cols"
          style={{
            maxWidth: 1120, margin: '0 auto',
            display: 'flex', alignItems: 'flex-start', gap: 60,
            position: 'relative', zIndex: 1,
          }}
        >
          {/* ── Left: copy ── */}
          <div style={{ flex: '1 1 480px', paddingBottom: 88 }} className="fade-up">
            {/* Announcement badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 28,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0 }}/>
              <span style={{ color: '#5eead4', fontSize: 12, fontWeight: 600 }}>
                WhatsApp alerts · INR billing · CA compliance built-in
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(38px, 5.2vw, 64px)',
              fontWeight: 800, lineHeight: 1.04,
              letterSpacing: '-2.5px', margin: '0 0 20px', color: '#fff',
            }}>
              Task management<br/>
              <span style={{
                background: 'linear-gradient(90deg, #2dd4bf 0%, #38bdf8 35%, #818cf8 70%, #2dd4bf 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'shimmer 6s linear infinite',
              }}>built for India.</span>
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize: 18, color: 'rgba(255,255,255,0.52)',
              lineHeight: 1.78, marginBottom: 36, maxWidth: 480,
            }}>
              Tasks, approvals, recurring checklists, WhatsApp reminders, and compliance tools — in one platform priced in rupees and designed for how Indian teams actually work.
            </p>

            {/* CTA row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
              <Link href="/login" className="btn-primary"
                style={{
                  background: '#f97316', color: '#fff', padding: '14px 32px', borderRadius: 10,
                  fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 22px rgba(249,115,22,0.42)', display: 'inline-block',
                  letterSpacing: '-0.2px',
                }}>
                Start free — no card needed
              </Link>
              <a href="#features" className="btn-ghost"
                style={{
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)',
                  padding: '14px 22px', borderRadius: 10,
                  fontSize: 15, fontWeight: 500, textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.12)', display: 'inline-block',
                }}>
                See how it works
              </a>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', letterSpacing: '0.02em' }}>
              14-day free trial&nbsp;&nbsp;·&nbsp;&nbsp;Setup in 15 min&nbsp;&nbsp;·&nbsp;&nbsp;Cancel anytime
            </p>
          </div>

          {/* ── Right: product preview ── */}
          <div className="hero-visual" style={{
            flex: '1 1 460px', display: 'flex',
            alignItems: 'flex-end', alignSelf: 'stretch',
          }}>
            <div style={{
              width: '100%', maxWidth: 460,
              background: '#fff', borderRadius: '16px 16px 0 0',
              boxShadow: '0 -8px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              {/* Browser chrome */}
              <div style={{ background: '#1e293b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => (
                    <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'block' }}/>
                  ))}
                </div>
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 5, height: 20,
                  display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }}/>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>app.taska.in/tasks</span>
                </div>
              </div>

              {/* App top bar */}
              <div style={{
                background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>My Tasks</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>3 due today · 1 overdue</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['Overdue','#fef2f2','#dc2626','#fca5a5'],['Today','#f0fdfa','#0d9488','#5eead4'],['This week','#f8fafc','#64748b','#e2e8f0']].map(([t,bg,color,border]) => (
                    <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}` }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Task list */}
              <div style={{ background: '#fff' }}>
                {[
                  { title:'GSTR-3B filing — October', status:'Overdue', sc:'#dc2626', sb:'#fef2f2', av:'RS', avBg:'#fee2e2', avC:'#dc2626', due:'Oct 20', overdue:true },
                  { title:'Client invoice review',    status:'Needs approval', sc:'#f97316', sb:'#fff7ed', av:'AM', avBg:'#ffedd5', avC:'#ea580c', due:'Today', overdue:false },
                  { title:'TDS return Q2',             status:'🔁 Recurring',  sc:'#7c3aed', sb:'#faf5ff', av:'KP', avBg:'#ede9fe', avC:'#7c3aed', due:'Oct 25', overdue:false },
                  { title:'Payroll reconciliation',   status:'Done ✓',       sc:'#16a34a', sb:'#dcfce7', av:'RS', avBg:'#dcfce7', avC:'#16a34a', due:'Oct 18', done:true },
                ].map((task, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                    borderBottom: '1px solid #f8fafc',
                    background: task.overdue ? '#fffbfb' : '#fff',
                  }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      background: task.done ? '#0d9488' : 'transparent',
                      border: task.done ? 'none' : `2px solid ${task.overdue ? '#fca5a5' : '#cbd5e1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {task.done && <span style={{ color: '#fff', fontSize: 7, fontWeight: 800 }}>✓</span>}
                    </div>
                    {/* Title */}
                    <span style={{
                      flex: 1, fontSize: 12, fontWeight: 500, minWidth: 0,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      color: task.done ? '#94a3b8' : '#0f172a',
                      textDecoration: task.done ? 'line-through' : 'none',
                    }}>{task.title}</span>
                    {/* Avatar */}
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: task.avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: task.avC, flexShrink: 0 }}>{task.av}</div>
                    {/* Due */}
                    <span style={{ fontSize: 10, color: task.overdue ? '#dc2626' : '#94a3b8', fontWeight: task.overdue ? 600 : 400, flexShrink: 0 }}>{task.due}</span>
                    {/* Status badge */}
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: task.sb, color: task.sc, flexShrink: 0, whiteSpace: 'nowrap' }}>{task.status}</span>
                  </div>
                ))}
              </div>

              {/* WhatsApp notification */}
              <div style={{
                background: '#f0fdf4', borderTop: '1px solid #bbf7d0',
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d' }}>WhatsApp sent to RS</div>
                  <div style={{ fontSize: 10, color: '#4ade80', marginTop: 1 }}>GSTR-3B was due today — task escalated to manager</div>
                </div>
                <span style={{ fontSize: 9, color: '#86efac', flexShrink: 0 }}>Just now</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TRUST STRIP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '22px 6%' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div className="stats-row" style={{ display: 'flex', gap: 44 }}>
            {[
              { v: '200+',  l: 'teams on Taska' },
              { v: '₹999',  l: 'from per month' },
              { v: '4.9★',  l: 'average rating' },
              { v: '99.9%', l: 'uptime SLA' },
            ].map(({ v, l }) => (
              <div key={l}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0d9488', letterSpacing: '-0.5px' }}>{v}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>Trusted by</span>
            {['CA firms','Agencies','Operations','Legal teams','Startups'].map(t => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 600, color: '#475569',
                background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 99,
              }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 3 KEY DIFFERENTIATORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ padding: '92px 6%', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Why teams choose Taska</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 14, margin: '0 0 14px' }}>
              Everything global tools miss<br/>for the Indian market
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '16px auto 0', lineHeight: 1.7 }}>
              Most task tools were designed for US teams. Taska was built for how Indian businesses actually operate.
            </p>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                icon: '💬',
                color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
                title: 'WhatsApp-first reminders',
                body: 'Tasks due, approvals blocked, deadlines missed — alerts land in WhatsApp where your team already is. No app to install. No ignored email.',
                tag: 'No app required',
              },
              {
                icon: '🇮🇳',
                color: '#f97316', bg: '#fff7ed', border: '#fed7aa',
                title: 'Flat INR pricing',
                body: 'From ₹999/month for your whole team — not ₹900 per person like foreign tools. One bill. No USD conversion. No per-user upsell traps.',
                tag: 'No per-user fees',
              },
              {
                icon: '🏛️',
                color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
                title: 'CA & compliance built-in',
                body: '69 pre-built compliance tasks for GSTR, TDS, ITR, and ROC. Auto-creates document subtasks and sends alerts before every statutory deadline.',
                tag: '69 compliance tasks ready',
              },
            ].map((d, i) => (
              <div key={i} className="card-lift" style={{
                background: '#fff', borderRadius: 16, padding: '32px 28px',
                border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: d.bg, border: `1px solid ${d.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 18,
                }}>{d.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 10, color: '#0f172a' }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.72, marginBottom: 18 }}>{d.body}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 700, color: d.color,
                  background: d.bg, border: `1px solid ${d.border}`,
                  borderRadius: 99, padding: '3px 10px',
                }}>✓ {d.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="features" style={{ padding: '92px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Everything you need</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, margin: '0 0 14px' }}>
              Six features your team uses<br/>every single day
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
              Not features for the sake of features. Tools that close tasks, enforce accountability, and give you real visibility.
            </p>
          </div>

          {/* 2 large hero features */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              borderRadius: 20, padding: '40px 36px', color: '#fff', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }}/>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>Automation</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12, lineHeight: 1.2 }}>Recurring tasks,<br/>zero effort</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.72, marginBottom: 24, maxWidth: 320 }}>
                Set any task to repeat daily, weekly, monthly, or quarterly. Taska creates it, assigns it, and starts the clock automatically.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Daily','Weekly','Monthly','Quarterly','Annual'].map(f => (
                  <span key={f} style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 99, padding: '4px 12px', color: 'rgba(255,255,255,0.9)' }}>{f}</span>
                ))}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
              borderRadius: 20, padding: '40px 36px', color: '#fff', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }}/>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(167,139,250,0.75)', marginBottom: 12 }}>Workflow</div>
              <h3 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12, lineHeight: 1.2 }}>Approval in one click,<br/>full audit trail</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.68)', lineHeight: 1.72, marginBottom: 24, maxWidth: 320 }}>
                Staff submit work for manager sign-off. Approve or return with one click. Every decision is logged with timestamp and comment.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#16a34a', borderRadius: 99, padding: '4px 12px' }}>Approved ✓</span>
                <span style={{ fontSize: 12, fontWeight: 700, background: '#fef2f2', color: '#dc2626', borderRadius: 99, padding: '4px 12px' }}>Returned with note</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '4px 12px' }}>Full audit log</span>
              </div>
            </div>
          </div>

          {/* 4 smaller features */}
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { icon:'✅', color:'#0d9488', bg:'#f0fdfa', border:'#5eead4', title:'Smart tasks', desc:'Assign, prioritise, bulk-complete. Filter by client, project, due date, or person in seconds.' },
              { icon:'⏱️', color:'#0891b2', bg:'#f0f9ff', border:'#7dd3fc', title:'Time tracking', desc:'Log hours per task. Separate billable and non-billable. Export reports for invoicing.' },
              { icon:'📊', color:'#475569', bg:'#f8fafc', border:'#e2e8f0', title:'Reports', desc:'Completion rates, overdue trends, team performance. Filter by any dimension, export as CSV.' },
              { icon:'🔒', color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe', title:'Role permissions', desc:'Owners, managers, members, viewers. Granular control — everyone sees exactly what they need.' },
            ].map((f, i) => (
              <div key={i} className="card-lift" style={{
                background: '#fff', borderRadius: 14, padding: '24px 20px',
                border: '1px solid #f1f5f9', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 7, letterSpacing: '-0.2px', color: '#0f172a' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ padding: '92px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em' }}>How it works</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              Up and running in 15 minutes
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
              No onboarding call. No 40-field setup. Just start.
            </p>
          </div>

          <div className="steps-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
            {/* Connector */}
            <div className="step-connector" style={{ position: 'absolute', top: 39, left: '18%', right: '18%', height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0 15%, #e2e8f0 85%, transparent)', zIndex: 0 }}/>

            {[
              { n: '01', title: 'Invite your team',  body: 'Add members, assign roles — owner, manager, member, viewer. Done in under 2 minutes.' },
              { n: '02', title: 'Create & assign tasks', body: 'Add tasks manually, use templates, or let Taska generate compliance tasks automatically for your CA firm.' },
              { n: '03', title: 'Stay accountable automatically', body: 'Taska sends WhatsApp reminders, tracks completion, escalates blockers — without anyone manually chasing anyone.' },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 28px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
                  background: i === 1 ? '#0d9488' : '#fff',
                  border: i === 1 ? 'none' : '2px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: i === 1 ? '0 8px 28px rgba(13,148,136,0.32)' : '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: i === 1 ? '#fff' : '#0d9488', letterSpacing: '-0.5px' }}>{step.n}</span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 10, color: '#0f172a' }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 240, margin: '0 auto' }}>{step.body}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <Link href="/login" className="btn-primary"
              style={{
                display: 'inline-block', background: '#f97316', color: '#fff',
                padding: '13px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 4px 20px rgba(249,115,22,0.38)',
              }}>
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ SOLUTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="solutions" style={{ padding: '92px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Who it&apos;s for</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              Built for every Indian team type
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
              Taska adapts to your workflow — not the other way around.
            </p>
          </div>

          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              {
                icon:'🏛️', color:'#f97316', bg:'#fff7ed', border:'#fed7aa',
                title:'CA & Accounting',
                features:['69 compliance tasks', 'GSTR · TDS · ITR · ROC', 'Document upload enforcement', 'Statutory deadline alerts'],
              },
              {
                icon:'🏢', color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe',
                title:'Agencies & Studios',
                features:['Client deliverable tracking', 'Approval workflows', 'Retainer management', 'Multi-client view'],
              },
              {
                icon:'🏗️', color:'#0d9488', bg:'#f0fdfa', border:'#5eead4',
                title:'Operations Teams',
                features:['Recurring SOP checklists', 'Performance dashboards', 'Cross-department tasks', 'Time & cost tracking'],
              },
              {
                icon:'📐', color:'#0891b2', bg:'#f0f9ff', border:'#7dd3fc',
                title:'Legal & Consulting',
                features:['Matter deadline tracking', 'Document upload per task', 'Client workspace access', 'Escalation paths'],
              },
            ].map((u, i) => (
              <div key={i} className="card-lift" style={{
                background: '#fff', borderRadius: 16, padding: '26px 20px',
                border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: u.bg, border: `1px solid ${u.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{u.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#0f172a', letterSpacing: '-0.2px' }}>{u.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {u.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#64748b' }}>
                      <span style={{ color: u.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COMPARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="compare" style={{ padding: '92px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compare</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              Why teams switch to Taska
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
              Priced for India. Features that foreign tools don&apos;t offer — at any price point.
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 18, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ padding: '18px 22px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', width: '34%' }}>Feature</th>
                  <th style={{ padding: '18px 14px', textAlign: 'center', background: '#0a0f1e', borderBottom: '2px solid #0d9488', minWidth: 110 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>T</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Taska</span>
                      <span style={{ fontSize: 10, color: '#2dd4bf', fontWeight: 600 }}>₹999/mo</span>
                    </div>
                  </th>
                  {[['Asana','$10.99/user'],['Worklenz','Free / Open'],['Plane','$8/user']].map(([name, price]) => (
                    <th key={name} style={{ padding: '18px 14px', textAlign: 'center', background: '#fafaf9', borderBottom: '1px solid #e2e8f0', minWidth: 100 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature:'INR billing (no USD)',        taska:true,  asana:false, wl:false,       plane:false, usp:true  },
                  { feature:'WhatsApp notifications',      taska:true,  asana:false, wl:false,       plane:false, usp:true  },
                  { feature:'CA & compliance workflows',   taska:true,  asana:false, wl:false,       plane:false, usp:true  },
                  { feature:'India data residency',        taska:true,  asana:false, wl:false,       plane:false, usp:true  },
                  { feature:'Flat team pricing',           taska:true,  asana:false, wl:'partial',   plane:false, usp:true  },
                  { feature:'Recurring tasks',             taska:true,  asana:true,  wl:'partial',   plane:'partial', usp:false },
                  { feature:'Approval workflows',          taska:true,  asana:true,  wl:false,       plane:false, usp:false },
                  { feature:'Time tracking',               taska:true,  asana:true,  wl:true,        plane:true,  usp:false },
                  { feature:'Reports & exports',           taska:true,  asana:true,  wl:'partial',   plane:true,  usp:false },
                  { feature:'API access',                  taska:true,  asana:true,  wl:false,       plane:true,  usp:false },
                ].map((row, i) => {
                  const bg = i % 2 === 0 ? '#fff' : '#fafafa'
                  function Cell({ val, hl }: { val: boolean | string; hl?: boolean }) {
                    return (
                      <td style={{ padding: '12px 14px', textAlign: 'center', background: hl ? 'rgba(13,148,136,0.04)' : bg, borderBottom: '1px solid #f1f5f9' }}>
                        {val === true  ? <span style={{ fontSize: 16 }}>✅</span>
                        : val === false ? <span style={{ fontSize: 14, color: '#e2e8f0' }}>—</span>
                        : <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 99 }}>Partial</span>}
                      </td>
                    )
                  }
                  return (
                    <tr key={row.feature}>
                      <td style={{ padding: '12px 22px', fontSize: 13, fontWeight: row.usp ? 600 : 400, color: '#374151', background: bg, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {row.feature}
                          {row.usp && <span style={{ fontSize: 9, fontWeight: 700, background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa', padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase', flexShrink: 0 }}>India-first</span>}
                        </span>
                      </td>
                      <Cell val={row.taska} hl />
                      <Cell val={row.asana} />
                      <Cell val={row.wl} />
                      <Cell val={row.plane} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ━━━ PRICING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="pricing" style={{ padding: '92px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pricing</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              Simple pricing, billed in INR
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
              Flat team pricing — not per user. Start free and upgrade when you grow.
            </p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
            {[
              {
                name:'Free', price:'0', period:'', color:'#64748b', bg:'#fff', border:'#e2e8f0',
                badge:'', primary:false, cta:'Start free',
                features:['Up to 5 members','3 active projects','Unlimited tasks','WhatsApp alerts (basic)','Task comments & activity'],
              },
              {
                name:'Starter', price:'999', period:'/mo', color:'#0d9488', bg:'#fff', border:'#0d9488',
                badge:'Most popular', primary:true, cta:'Start free trial',
                features:['Up to 15 members','15 projects','Recurring task automation','Approval workflows','Time tracking','Reports & CSV export'],
              },
              {
                name:'Pro', price:'2,999', period:'/mo', color:'#7c3aed', bg:'#fff', border:'#ddd6fe',
                badge:'', primary:false, cta:'Start free trial',
                features:['Up to 50 members','Unlimited projects','CA compliance module','Custom fields & templates','API access','Priority support'],
              },
            ].map((plan) => (
              <div key={plan.name} style={{
                background: plan.bg,
                border: plan.primary ? `2px solid ${plan.color}` : `1px solid ${plan.border}`,
                borderRadius: 18, padding: '28px 24px', position: 'relative',
                boxShadow: plan.primary ? '0 8px 32px rgba(13,148,136,0.16)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 99, whiteSpace: 'nowrap' }}>{plan.badge}</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: plan.primary ? plan.color : '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 22 }}>
                  {plan.price !== '0' && <span style={{ fontSize: 12, color: '#94a3b8' }}>₹</span>}
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px' }}>{plan.price === '0' ? 'Free' : plan.price}</span>
                  {plan.period && <span style={{ fontSize: 12, color: '#94a3b8' }}>{plan.period}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                      <span style={{ color: plan.primary ? plan.color : '#94a3b8', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link href="/login" style={{
                  display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 10,
                  background: plan.primary ? plan.color : 'transparent',
                  color: plan.primary ? '#fff' : plan.color,
                  border: `1.5px solid ${plan.color}`,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: plan.primary ? `0 4px 16px ${plan.color}38` : 'none',
                }}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 22 }}>
            All plans include 14-day free trial · No credit card required · Cancel anytime · Billed in INR
          </p>

          {/* ── One-time Setup & Onboarding ── */}
          <div style={{
            marginTop: 36,
            borderRadius: 16, padding: '28px 32px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: '#fff7ed', border: '1px solid #fed7aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>🚀</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Professional Setup &amp; Onboarding
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                  background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>One-time</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
                Get a dedicated onboarding expert who migrates your existing data, configures workflows for your team, and trains everyone to hit the ground running — so you go live without any disruption.
              </p>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {['Existing data migration','Custom workflow setup','Team training session','Priority go-live support'].map(f => (
                  <span key={f} style={{ fontSize: 12, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> {f}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>₹</span>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px' }}>5,000</span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>one-time · any plan</div>
              <Link href="/login" style={{
                display: 'inline-block', padding: '10px 22px', borderRadius: 10,
                background: '#f97316', color: '#fff',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 3px 14px rgba(249,115,22,0.35)',
              }}>
                Get started →
              </Link>
            </div>
          </div>

          {/* ── Enterprise / Self-Hosted ── */}
          <div style={{
            marginTop: 16,
            borderRadius: 16, padding: '28px 32px',
            background: 'linear-gradient(135deg, #0a0f1e 0%, #0c1a32 100%)',
            border: '1px solid rgba(13,148,136,0.22)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>🔐</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                  Private Cloud / Self-Hosted
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                  background: 'rgba(13,148,136,0.2)', color: '#2dd4bf',
                  border: '1px solid rgba(13,148,136,0.35)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>Enterprise</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
                For data-sensitive organisations — banks, legal firms, healthcare, and regulated industries — that need all data to live exclusively on their own servers. You get the full Taska platform deployed inside your infrastructure with zero data ever leaving your network.
              </p>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {['Your servers · your DB','Zero cloud dependency','DPDP & compliance-ready','Dedicated deployment support'].map(f => (
                  <span key={f} style={{ fontSize: 12, color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> {f}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Custom pricing</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginBottom: 14 }}>based on team size &amp; infra</div>
              <a href="mailto:hello@taska.in?subject=Self-Hosted%20Inquiry" style={{
                display: 'inline-block', padding: '10px 22px', borderRadius: 10,
                background: '#0d9488', color: '#fff',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 3px 14px rgba(13,148,136,0.4)',
              }}>
                Talk to us →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TESTIMONIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="testimonials" style={{ padding: '92px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', margin: '0 0 10px' }}>
              Teams who made the switch
            </h2>
            <p style={{ fontSize: 15, color: '#64748b' }}>What early users say after one month on Taska.</p>
          </div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { init:'PS', color:'#f97316', name:'Priya S.', role:'Managing Partner', co:'Mid-size CA firm', quote:'We replaced three separate tools with Taska. The recurring task engine saves us 4+ hours every single month-end. The WhatsApp reminders changed how our team operates.', metric:'4+ hrs/month saved' },
              { init:'RM', color:'#0d9488', name:'Rahul M.', role:'Founder', co:'Digital agency, Pune', quote:'Task completion jumped from 67% to 94% in six weeks. Our managers spend less time chasing and more time reviewing actual work. The approval flow is exactly what we needed.', metric:'67% → 94% completion' },
              { init:'AN', color:'#7c3aed', name:'Anjali N.', role:'Head of Ops', co:'Creative studio', quote:'Setup took 20 minutes. INR pricing was a no-brainer versus Asana. Client management, approvals, and time tracking are finally in one place. ROI was visible in week one.', metric:'ROI in week 1' },
            ].map(t => (
              <div key={t.name} className="card-lift" style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {'★★★★★'.split('').map((s, i) => <span key={i} style={{ color: '#fbbf24', fontSize: 14 }}>{s}</span>)}
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 14, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: t.color, background: '#fff', border: `1px solid ${t.color}28`, borderRadius: 99, padding: '3px 10px', marginBottom: 18 }}>{t.metric}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${t.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: t.color, flexShrink: 0 }}>{t.init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.role} · {t.co}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SECURITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ padding: '72px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '4px 14px', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Security &amp; trust</span>
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 10px' }}>Your data is safe with us</h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 340, margin: '0 auto', lineHeight: 1.7 }}>Enterprise-grade security without the enterprise overhead.</p>
          </div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { icon:'🔐', title:'End-to-end encryption',  desc:'TLS 1.3 in transit and AES-256 at rest. All data encrypted at every layer.' },
              { icon:'🇮🇳', title:'India data residency',   desc:'Your data stays in Indian data centres — not subject to US CLOUD Act.' },
              { icon:'👥', title:'Role-based access',       desc:'Granular permissions per role. Members only see what they need.' },
              { icon:'📋', title:'Full audit trail',         desc:'Every action logged with timestamp. Know who did what and when.' },
              { icon:'🗑️', title:'Your data, your control', desc:'Export or delete everything, anytime. No hostage data, no lock-in.' },
              { icon:'🛡️', title:'DPDP Act aligned',        desc:"Designed to align with India's Digital Personal Data Protection Act." },
            ].map(s => (
              <div key={s.title} style={{ display: 'flex', gap: 14, padding: '18px 20px', background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ padding: '92px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', margin: '0 0 10px' }}>Questions we always get</h2>
            <p style={{ fontSize: 15, color: '#64748b' }}>Quick answers. No sales call required.</p>
          </div>
          <div>
            {[
              {
                q: 'Does my team need to install anything?',
                a: 'Nothing. Taska is fully web-based — any browser, any device. WhatsApp alerts work natively through WhatsApp without any installation on your server or device.',
              },
              {
                q: 'How does the WhatsApp integration work?',
                a: 'When a task is due, overdue, stuck in approval, or needs escalation, Taska sends a WhatsApp message to the assigned team member. No login needed for the recipient — the message lands directly in their WhatsApp.',
              },
              {
                q: 'How is Taska different from Asana or ClickUp?',
                a: 'Those tools are designed for US or global teams. Taska is built specifically for India: INR billing with no per-user USD fees, WhatsApp-first notifications (not email-first), Indian data residency, and a built-in CA/compliance module that no global tool offers at any price.',
              },
              {
                q: 'Can I try before paying?',
                a: 'Yes. The Free plan is free forever for up to 5 people. All paid plans include a 14-day free trial — no credit card required to start.',
              },
              {
                q: 'What happens if I cancel?',
                a: "Cancel any time from your billing settings. You keep access until the end of your billing period. You can export all your data at any time — we'll assist if needed. No lock-in.",
              },
              {
                q: 'Is my data stored in India?',
                a: "Yes. All data is stored in Indian data centres and does not leave India. This is designed to align with the requirements of the Digital Personal Data Protection (DPDP) Act.",
              },
            ].map((faq, i) => (
              <details key={i} className="faq-details" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <summary style={{
                  padding: '20px 0', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16,
                  fontSize: 15, fontWeight: 600, color: '#0f172a',
                }}>
                  {faq.q}
                  <span className="faq-icon" style={{ fontSize: 20, color: '#94a3b8', flexShrink: 0, fontWeight: 300, lineHeight: 1 }}>+</span>
                </summary>
                <p style={{ paddingBottom: 22, fontSize: 14, color: '#64748b', lineHeight: 1.78, margin: 0 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        padding: '100px 6%',
        background: 'linear-gradient(160deg, #0a0f1e 0%, #0c1a32 55%, #0a1224 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: '28%', width: 560, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.1) 0%, transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4.5vw, 52px)',
            fontWeight: 800, color: '#fff',
            letterSpacing: '-2px', marginBottom: 16, lineHeight: 1.1,
          }}>
            Stop chasing your team.<br/>Start closing tasks.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.46)', marginBottom: 36, lineHeight: 1.75 }}>
            Join 200+ Indian teams running their work on Taska.<br/>Free to start — no credit card needed.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary"
              style={{
                background: '#f97316', color: '#fff', padding: '15px 36px', borderRadius: 11,
                fontSize: 16, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 6px 28px rgba(249,115,22,0.48)', display: 'inline-block', letterSpacing: '-0.2px',
              }}>
              Start free trial
            </Link>
            <Link href="/login" className="btn-ghost"
              style={{
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.82)',
                padding: '15px 24px', borderRadius: 11, fontSize: 15, fontWeight: 500,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', display: 'inline-block',
              }}>
              Sign in instead
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginTop: 20, letterSpacing: '0.02em' }}>
            14-day free trial&nbsp;&nbsp;·&nbsp;&nbsp;No credit card&nbsp;&nbsp;·&nbsp;&nbsp;Cancel anytime&nbsp;&nbsp;·&nbsp;&nbsp;Billed in INR
          </p>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer style={{ background: '#0a0f1e', padding: '52px 6% 28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 44 }}>
            {/* Brand column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Taska</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.72, maxWidth: 240, margin: '0 0 18px' }}>
                Task management built for Indian teams. WhatsApp-first, INR-priced, compliance-ready.
              </p>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Made with ♥ in India 🇮🇳</div>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>Product</div>
              {['Features','Solutions','Pricing','Changelog','Roadmap'].map(l => (
                <a key={l} href="#" className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 10 }}>{l}</a>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>Company</div>
              {['About','Blog','Careers','Contact','Status'].map(l => (
                <a key={l} href="#" className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 10 }}>{l}</a>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>Legal</div>
              {['Privacy policy','Terms of service','Data processing','Security','Cookie policy'].map(l => (
                <a key={l} href="#" className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 10 }}>{l}</a>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>© 2025 Taska Technology Pvt. Ltd. All rights reserved.</div>
            <div style={{ display: 'flex', gap: 22 }}>
              {['Privacy','Terms','Security','Status'].map(l => (
                <a key={l} href="#" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
