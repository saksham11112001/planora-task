import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafaf9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden',
      color: '#0f172a',
      colorScheme: 'light',
    }}>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(-2deg)} 50%{transform:translateY(-14px) rotate(2deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(2deg)} 50%{transform:translateY(-10px) rotate(-1deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-18px)} }
        @keyframes float4 { 0%,100%{transform:translateY(0px) rotate(1deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes pulse-ring { 0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(13,148,136,0.4)} 70%{transform:scale(1);box-shadow:0 0 0 20px rgba(13,148,136,0)} 100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(13,148,136,0)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes slide-up { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce-in { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        .float1{animation:float1 6s ease-in-out infinite}
        .float2{animation:float2 7s ease-in-out infinite 1s}
        .float3{animation:float3 8s ease-in-out infinite 2s}
        .float4{animation:float4 5s ease-in-out infinite 0.5s}
        .slide-up{animation:slide-up 0.7s ease both}
        .hero-card{transition:transform 0.3s ease,box-shadow 0.3s ease}
        .hero-card:hover{transform:translateY(-4px) scale(1.02)!important;box-shadow:0 20px 52px rgba(0,0,0,0.2)!important}
        .feature-card{transition:all 0.25s ease}
        .feature-card:hover{transform:translateY(-6px);box-shadow:0 24px 56px rgba(0,0,0,0.12)!important}
        .cta-primary{transition:all 0.2s ease!important}
        .cta-primary:hover{transform:translateY(-2px)!important;box-shadow:0 10px 30px rgba(249,115,22,0.55)!important}
        .nav-link{transition:color 0.15s}
        .nav-link:hover{color:#0f172a!important}
        .specs-card{transition:all 0.3s ease}
        .specs-card:hover{transform:scale(1.06)!important;z-index:10!important}
        @media(max-width:768px){
          .hero-right{display:none!important}
          .hide-mobile{display:none!important}
          .specs-hub{display:none!important}
          .mobile-grid{display:grid!important}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', padding: '0 6%', height: 64, gap: 24,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#0d9488,#0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 16,
            boxShadow: '0 4px 12px rgba(13,148,136,0.4)',
          }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', color: '#0f172a' }}>Taska</span>
        </Link>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }} className="hide-mobile">
          {[['Features','#features'],['Solutions','#solutions'],['Pricing','#pricing'],['Testimonials','#testimonials']].map(([l,h]) => (
            <a key={l} href={h} className="nav-link"
              style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/login" className="nav-link hide-mobile"
            style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          <Link href="/login" className="cta-primary"
            style={{
              background: '#f97316', color: '#fff', padding: '9px 22px', borderRadius: 10,
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 3px 14px rgba(249,115,22,0.38)', display: 'inline-block',
            }}>Start free →</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 42%,#0d4a44 72%,#0f172a 100%)',
        padding: '80px 6% 0', position: 'relative', overflow: 'hidden', minHeight: 640,
      }}>
        {/* BG grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}/>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -100, left: '18%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,0.22) 0%,transparent 70%)' }}/>
        <div style={{ position: 'absolute', top: 60, right: '8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,0.18) 0%,transparent 70%)' }}/>
        <div style={{ position: 'absolute', bottom: 0, left: '40%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 70%)' }}/>

        <div style={{
          maxWidth: 1200, margin: '0 auto', display: 'flex',
          alignItems: 'flex-start', gap: 60, position: 'relative', zIndex: 1,
        }}>
          {/* Left: headline */}
          <div style={{ flex: '1 1 420px', paddingBottom: 72 }} className="slide-up">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(13,148,136,0.18)', border: '1px solid rgba(13,148,136,0.38)',
              borderRadius: 99, padding: '5px 16px', marginBottom: 28,
            }}>
              <span style={{ fontSize: 11 }}>💬</span>
              <span style={{ color: '#2dd4bf', fontSize: 12, fontWeight: 700 }}>WhatsApp alerts · INR billing · No USD ever</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(38px,5.5vw,66px)', fontWeight: 900, lineHeight: 1.02,
              letterSpacing: '-3px', margin: '0 0 22px', color: '#fff',
            }}>
              Work smarter.<br/>
              <span style={{
                background: 'linear-gradient(90deg,#2dd4bf,#f97316,#a78bfa,#2dd4bf)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'shimmer 4s linear infinite',
              }}>Miss nothing.</span>
            </h1>

            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8, marginBottom: 32, maxWidth: 460 }}>
              The all-in-one workspace for modern Indian teams — tasks, approvals, recurring checklists, WhatsApp alerts, and reports. Everything in one place.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <Link href="/login" className="cta-primary"
                style={{
                  background: '#f97316', color: '#fff', padding: '15px 34px', borderRadius: 12,
                  fontSize: 16, fontWeight: 800, textDecoration: 'none',
                  boxShadow: '0 6px 28px rgba(249,115,22,0.52)', display: 'inline-block', letterSpacing: '-0.3px',
                }}>Start free trial →</Link>
              <a href="#features" style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '15px 24px', borderRadius: 12,
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', backdropFilter: 'blur(8px)',
              }}>See how it works</a>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', lineHeight: 1.7 }}>
              ✓ No credit card &nbsp;·&nbsp; ✓ Free for 5 people &nbsp;·&nbsp; ✓ Setup in 15 min
            </p>

            <div style={{
              display: 'flex', gap: 28, paddingTop: 28, marginTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap',
            }}>
              {[['200+','teams'],['₹999','from /mo'],['4.9★','rating'],['99.9%','uptime']].map(([v,l]) => (
                <div key={l}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316', letterSpacing: '-0.5px' }}>{v}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: floating product cards */}
          <div className="hero-right" style={{ flex: '1 1 440px', position: 'relative', height: 540, minWidth: 340 }}>

            {/* Central app preview card */}
            <div className="hero-card" style={{
              position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
              width: 296, background: '#fff', borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 28px 80px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)', zIndex: 5,
            }}>
              {/* Browser chrome */}
              <div style={{ background: '#1e293b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => (
                    <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'block' }}/>
                  ))}
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 5, height: 18, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>app.taska.in/dashboard</span>
                </div>
              </div>
              {/* App content */}
              <div style={{ padding: 14 }}>
                <div style={{
                  background: '#fff7ed', borderRadius: 8, padding: '10px 12px', marginBottom: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fed7aa',
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#ea580c', fontWeight: 600, marginBottom: 2 }}>Good morning, Rahul 👋</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>3 tasks due today</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316' }}>94%</div>
                    <div style={{ fontSize: 8, color: '#94a3b8' }}>completion</div>
                  </div>
                </div>

                {[
                  { done: true,  title: 'Q3 client report',   tag: '✓ Done',      tc: '#16a34a', tb: '#dcfce7' },
                  { done: false, title: 'Invoice approval',   tag: 'Needs review', tc: '#ea580c', tb: '#fff7ed', hl: true },
                  { done: false, title: 'Weekly checklist',   tag: '🔁 Recurring', tc: '#7c3aed', tb: '#ede9fe' },
                ].map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                    borderRadius: 7, marginBottom: 5,
                    background: t.hl ? '#fff7ed' : '#f8fafc',
                    border: t.hl ? '1px solid #fed7aa' : '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                      background: t.done ? '#0d9488' : 'transparent',
                      border: t.done ? 'none' : `2px solid ${t.hl ? '#f97316' : '#cbd5e1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {t.done && <span style={{ color: '#fff', fontSize: 7, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{
                      flex: 1, fontSize: 11, fontWeight: 500,
                      color: t.done ? '#94a3b8' : '#0f172a',
                      textDecoration: t.done ? 'line-through' : 'none',
                    }}>{t.title}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: t.tb, color: t.tc }}>{t.tag}</span>
                  </div>
                ))}

                <div style={{
                  marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11 }}>💬</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#15803d' }}>WhatsApp reminder sent</div>
                    <div style={{ fontSize: 9, color: '#4ade80' }}>Invoice due in 2 hrs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card 1: Recurring */}
            <div className="float1 hero-card" style={{
              position: 'absolute', top: 20, left: -24,
              background: 'linear-gradient(135deg,#0d9488,#0891b2)', borderRadius: 14, padding: '12px 14px',
              boxShadow: '0 16px 40px rgba(13,148,136,0.5)', width: 148, zIndex: 4,
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>🔁</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>Recurring tasks</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Auto-created daily</div>
              <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 4, overflow: 'hidden' }}>
                <div style={{ width: '78%', height: '100%', background: 'rgba(255,255,255,0.8)', borderRadius: 6 }}/>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>78% done this week</div>
            </div>

            {/* Floating card 2: Approval */}
            <div className="float2 hero-card" style={{
              position: 'absolute', top: 55, right: -28,
              background: '#fff', borderRadius: 14, padding: '12px 14px', width: 152,
              boxShadow: '0 16px 40px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', zIndex: 4,
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>✍️</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Approval workflow</div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>1-click approve or return</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#dcfce7', color: '#16a34a' }}>Approved ✓</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626' }}>Returned</span>
              </div>
            </div>

            {/* Floating card 3: Reports */}
            <div className="float3 hero-card" style={{
              position: 'absolute', bottom: 70, left: -14,
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius: 14, padding: '12px 14px',
              boxShadow: '0 16px 40px rgba(124,58,237,0.45)', width: 144, zIndex: 4,
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>📈</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Team report</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[['Completed','87%','#34d399'],['On time','92%','#60a5fa']].map(([l,v,c]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>{l}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating card 4: WhatsApp */}
            <div className="float4 hero-card" style={{
              position: 'absolute', bottom: 50, right: -22,
              background: '#fff', borderRadius: 14, padding: '12px 14px', width: 156,
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', zIndex: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>💬</span>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#0f172a' }}>WhatsApp alert</div>
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>Just now</div>
                </div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '6px 8px', fontSize: 9, color: '#15803d', lineHeight: 1.55 }}>
                Task &ldquo;Invoice Q3&rdquo; is due in <strong>2 hours</strong>. Please complete or escalate.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Social proof bar ── */}
      <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '16px 6%', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[['200+','teams'],['15k+','tasks done'],['4.9★','rating'],['99.9%','uptime']].map(([n,l]) => (
              <div key={l}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#f97316', letterSpacing: '-0.5px' }}>{n}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Trusted by</span>
            {['CA firms','Agencies','Startups','Legal teams','Operations'].map(s => (
              <span key={s} style={{ fontSize: 11, fontWeight: 600, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 99 }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── SPECS ON A PERSON — central hub with floating feature cards ── */}
      <div style={{ background: 'linear-gradient(180deg,#f8fafc 0%,#fff 100%)', padding: '80px 6%', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', background: '#f0fdfa', color: '#0d9488', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #5eead4', marginBottom: 20 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 16, lineHeight: 1.1 }}>
            Everything your team needs,<br/>
            <span style={{ color: '#0d9488' }}>wired together</span>
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.75 }}>
            Taska connects every part of your workflow — from task creation to approval to reporting — in a single platform your whole team will actually use.
          </p>
        </div>

        {/* Hub layout — desktop */}
        <div className="specs-hub" style={{ position: 'relative', maxWidth: 920, margin: '0 auto', height: 580 }}>
          {/* SVG connecting lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
            viewBox="0 0 920 580" preserveAspectRatio="none">
            {[
              [460,290, 140,100], [460,290, 760,80],
              [460,290, 80,380],  [460,290, 790,370],
              [460,290, 270,500], [460,290, 640,500],
            ].map(([x1,y1,x2,y2],i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(13,148,136,0.18)" strokeWidth="1.5" strokeDasharray="6 4"/>
            ))}
            {/* Dots at endpoints */}
            {[[140,100],[760,80],[80,380],[790,370],[270,500],[640,500]].map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r="4" fill="rgba(13,148,136,0.35)"/>
            ))}
          </svg>

          {/* Central figure */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 5 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -14, borderRadius: '50%',
                border: '2px solid rgba(13,148,136,0.28)',
                animation: 'pulse-ring 2.8s ease-in-out infinite',
              }}/>
              <div style={{
                width: 108, height: 108, borderRadius: '50%',
                background: 'linear-gradient(135deg,#0d9488,#0891b2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 14px 40px rgba(13,148,136,0.55)', position: 'relative', zIndex: 1,
              }}>
                <span style={{ fontSize: 46 }}>👨‍💼</span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Your team</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>stays in sync</div>
              </div>
            </div>
          </div>

          {/* Orbiting feature cards */}
          {[
            { style: { top: 50, left: 50 },  float: 'float1', icon: '✅', title: 'One-time tasks', desc: 'Assign · Track · Complete', color: '#0d9488', bg: '#f0fdfa' },
            { style: { top: 30, right: 50 },  float: 'float2', icon: '🔁', title: 'Recurring tasks', desc: 'Daily · Weekly · Monthly', color: '#7c3aed', bg: '#faf5ff' },
            { style: { top: 340, left: 10 },  float: 'float3', icon: '✍️', title: 'Approval flow', desc: 'Submit · Review · Done', color: '#f97316', bg: '#fff7ed' },
            { style: { top: 320, right: 10 }, float: 'float4', icon: '💬', title: 'WhatsApp alerts', desc: 'Never miss a deadline', color: '#16a34a', bg: '#f0fdf4' },
            { style: { bottom: 30, left: 180 },float: 'float2', icon: '⏱️', title: 'Time tracking', desc: 'Log · Report · Bill', color: '#0891b2', bg: '#f0f9ff' },
            { style: { bottom: 30, right: 160 },float: 'float1', icon: '📊', title: 'Reports', desc: 'Real-time insights', color: '#dc2626', bg: '#fef2f2' },
          ].map((card, i) => (
            <div key={i} className={`${card.float} specs-card`}
              style={{
                position: 'absolute', ...card.style,
                background: card.bg, borderRadius: 14, padding: '14px 16px', width: 154,
                border: `1.5px solid ${card.color}28`,
                boxShadow: `0 8px 28px ${card.color}18`, zIndex: 3,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${card.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 17 }}>{card.icon}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{card.title}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{card.desc}</div>
            </div>
          ))}
        </div>

        {/* Mobile fallback */}
        <div className="mobile-grid" style={{ display: 'none', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, maxWidth: 640, margin: '0 auto' }}>
          {[
            { icon:'✅', title:'One-time tasks', color:'#0d9488', bg:'#f0fdfa' },
            { icon:'🔁', title:'Recurring tasks', color:'#7c3aed', bg:'#faf5ff' },
            { icon:'✍️', title:'Approvals', color:'#f97316', bg:'#fff7ed' },
            { icon:'💬', title:'WhatsApp alerts', color:'#16a34a', bg:'#f0fdf4' },
            { icon:'⏱️', title:'Time tracking', color:'#0891b2', bg:'#f0f9ff' },
            { icon:'📊', title:'Reports', color:'#dc2626', bg:'#fef2f2' },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, borderRadius: 12, padding: '16px 14px', border: `1px solid ${c.color}22`, textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{c.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 6% 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: '#fff7ed', color: '#f97316', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #fed7aa', marginBottom: 16 }}>
            CORE FEATURES
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 12 }}>
            Built for teams who can&apos;t afford to miss deadlines
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Six features your team will use every single day.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
          {[
            { icon:'💬', color:'#25D366', bg:'#f0fdf4', border:'#86efac', badge:'Most-loved feature',
              title:'WhatsApp & email alerts',
              desc:'Tasks due, approvals stuck, deadlines missed — alerts go straight to WhatsApp where your team already is. No app install needed.' },
            { icon:'🔁', color:'#0d9488', bg:'#f0fdfa', border:'#5eead4', badge:'Saves hours every week',
              title:'Recurring tasks, automated',
              desc:'Set any task to repeat daily, weekly, monthly, or quarterly. Taska creates each instance, assigns it, and starts the clock automatically.' },
            { icon:'🧩', color:'#7c3aed', bg:'#faf5ff', border:'#c4b5fd', badge:'No-code workflow builder',
              title:'Custom workflows for any team',
              desc:'Build templates, approval chains, and custom fields for your exact process — no code required. Legal, ops, creative, finance, compliance.' },
            { icon:'✅', color:'#0891b2', bg:'#f0f9ff', border:'#7dd3fc', badge:'',
              title:'Smart task management',
              desc:'Assign, prioritise, bulk-complete. Filters by client, project, due date, or assignee.' },
            { icon:'✍️', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', badge:'',
              title:'Approval workflows',
              desc:'Staff submit work for manager sign-off. Approve or return with one click. Full audit trail included.' },
            { icon:'📈', color:'#dc2626', bg:'#fef2f2', border:'#fca5a5', badge:'',
              title:'Reports & time tracking',
              desc:'Completion rates, billable hours, overdue trends. Filter by person, team, or 30/90-day windows.' },
          ].map((f, i) => (
            <div key={i} className="feature-card" style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 18, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {f.badge && (
                <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, color: f.color, background: f.bg, border: `1px solid ${f.border}`, borderRadius: 99, padding: '2px 10px', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {f.badge}
                </div>
              )}
              <div style={{ width: 48, height: 48, borderRadius: 14, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>{f.icon}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px', color: '#0f172a' }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CUSTOM WORKFLOWS dark section ── */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)', padding: '72px 6%' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 22 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>🧩 Custom modules & integrations</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.15 }}>
              Tailored to your unique workflow
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.78, marginBottom: 28, maxWidth: 420 }}>
              Every team works differently. Build custom task templates, define your own approval chains, create fields specific to your process, and connect Taska to your tools via API — no developers needed.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
              {['Custom fields','Approval chains','Task templates','API access','Role permissions'].map(tag => (
                <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', padding: '4px 12px', borderRadius: 99 }}>{tag}</span>
              ))}
            </div>
            <Link href="/login" style={{ background: '#f97316', color: '#fff', padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(249,115,22,0.45)', display: 'inline-block' }}>
              Explore custom modules →
            </Link>
          </div>
          <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Your custom task template</div>
              {[
                { label: 'Client name', type: 'Text field', icon: '🔤' },
                { label: 'Due date', type: 'Date picker', icon: '📅' },
                { label: 'Invoice amount', type: 'Number field', icon: '💰' },
                { label: 'Approval required', type: 'Toggle · Approver', icon: '✍️' },
                { label: 'Document upload', type: 'File upload (required)', icon: '📎' },
              ].map(field => (
                <div key={field.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginBottom: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 16 }}>{field.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{field.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{field.type}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', fontSize: 12, color: '#f97316', fontWeight: 700, textAlign: 'center' }}>
                + Add custom field
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SOLUTIONS ── */}
      <div id="solutions" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '72px 6%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: '#f0fdfa', color: '#0d9488', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #5eead4', marginBottom: 16 }}>
              WHO IT&apos;S FOR
            </div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>
              One platform, every team
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
              Taska adapts to your workflow — not the other way around.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {[
              { icon:'🏛️', label:'CA & Accounting', desc:'69 pre-built compliance tasks — GSTR, TDS, ITR, ROC. Auto-creates document subtasks.', color:'#f97316' },
              { icon:'🏢', label:'Agencies & studios', desc:'Manage client deliverables, approvals, and retainers in one workspace.', color:'#7c3aed' },
              { icon:'🏗️', label:'Operations teams', desc:'Recurring checklists, SOP enforcement, team performance dashboards.', color:'#0d9488' },
              { icon:'📐', label:'Legal & consulting', desc:'Matter tracking, deadline alerts, document upload enforcement per task.', color:'#0891b2' },
            ].map(u => (
              <div key={u.label} className="feature-card" style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: '24px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${u.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 22 }}>{u.icon}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>{u.label}</h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, margin: 0 }}>{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 6%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: '#faf5ff', color: '#7c3aed', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #ddd6fe', marginBottom: 16 }}>
            PRICING
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 12 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 440, margin: '0 auto' }}>
            Billed in INR. No USD surprises. Start free, upgrade when you grow.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, alignItems: 'start' }}>
          {[
            { name:'Free', price:'0', color:'#64748b', bg:'#fff', border:'#e2e8f0', badge:'',
              features:['5 members','3 projects','Unlimited tasks','WhatsApp alerts'], cta:'Start free', primary:false },
            { name:'Starter', price:'999', color:'#0d9488', bg:'#f0fdfa', border:'#99f6e4', badge:'',
              features:['15 members','15 projects','Time tracking','Recurring tasks','Approval workflow'], cta:'Start free trial', primary:false },
            { name:'Pro', price:'2,999', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', badge:'⭐ Best value',
              features:['50 members','Unlimited projects','Custom modules','Advanced reports','API access','Priority support'], cta:'Start free trial', primary:true },
            { name:'Business', price:'7,999', color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe', badge:'',
              features:['Unlimited members','All Pro features','White-label','SSO / SAML','SLA guarantee','Dedicated manager'], cta:'Contact us', primary:false },
          ].map(p => (
            <div key={p.name} style={{
              background: p.bg,
              border: p.primary ? `2px solid ${p.color}` : `1px solid ${p.border}`,
              borderRadius: 18, padding: '28px 22px', position: 'relative',
              boxShadow: p.primary ? `0 12px 40px ${p.color}25` : '0 2px 8px rgba(0,0,0,0.04)',
              transform: p.primary ? 'scale(1.03)' : 'none',
            }}>
              {p.badge && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>{p.badge}</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>₹</span>
                <span style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px' }}>{p.price}</span>
                {p.price !== '0' && <span style={{ fontSize: 12, color: '#94a3b8' }}>/mo</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                    <span style={{ color: p.color, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/login" style={{
                display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 10,
                background: p.primary ? p.color : 'transparent',
                color: p.primary ? '#fff' : p.color,
                border: `1.5px solid ${p.color}`,
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: p.primary ? `0 4px 16px ${p.color}40` : 'none',
              }}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 24 }}>
          All plans include 14-day free trial · No credit card required · Cancel anytime
        </p>
      </div>

      {/* ── TESTIMONIALS ── */}
      <div id="testimonials" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '72px 6%' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 12 }}>
              {'★★★★★'.split('').map((s,i) => <span key={i} style={{ color: '#fbbf24', fontSize: 22 }}>{s}</span>)}
            </div>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>
              Teams love Taska
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 400, margin: '0 auto' }}>Here&apos;s what they say.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {[
              { name:'Priya Sharma', title:'Managing Partner', company:'Sharma & Associates', init:'PS', color:'#f97316',
                quote:'We replaced three separate tools with Taska. The recurring task automation alone saves us 4+ hours every single month-end.',
                metric:'4 hrs saved/month', mc:'#f97316' },
              { name:'Rahul Mehta', title:'Founder & CEO', company:'NexusDigital', init:'RM', color:'#0d9488',
                quote:'WhatsApp reminders changed how our team operates. Task completion went from 67% to 94% within six weeks.',
                metric:'67% → 94% completion', mc:'#0d9488' },
              { name:'Anjali Nair', title:'Head of Operations', company:'Kochi Creative Studio', init:'AN', color:'#7c3aed',
                quote:'Client management, time tracking, and approvals all in one place. Setup took 20 minutes. We saw ROI in the first week.',
                metric:'ROI in week 1', mc:'#7c3aed' },
            ].map(t => (
              <div key={t.name} className="feature-card" style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                  {'★★★★★'.split('').map((s,i) => <span key={i} style={{ color: '#fbbf24', fontSize: 14 }}>{s}</span>)}
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 20, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: 'inline-block', background: `${t.mc}12`, border: `1px solid ${t.mc}30`, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: t.mc, marginBottom: 20 }}>{t.metric}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${t.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: t.color, flexShrink: 0 }}>{t.init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.title} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECURITY ── */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 6%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 99, border: '1px solid #bbf7d0', marginBottom: 16 }}>
            ENTERPRISE-GRADE SECURITY
          </div>
          <h2 style={{ fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>Your data is safe with us</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {[
            { icon:'🔐', title:'End-to-end encryption', desc:'All data encrypted in transit (TLS 1.3) and at rest (AES-256).' },
            { icon:'🇮🇳', title:'India data residency', desc:'Your data stored in Indian data centres. Subject to Indian laws.' },
            { icon:'👥', title:'Role-based access', desc:'Granular permissions. Team members only see what they need.' },
            { icon:'📋', title:'Full audit trail', desc:'Every action logged. Know who did what and when.' },
            { icon:'🗑️', title:'Your data, your control', desc:'Export or delete all data at any time. No lock-in ever.' },
            { icon:'🛡️', title:'DPDP Act aligned', desc:"Designed to comply with India's Digital Personal Data Protection Act." },
          ].map(s => (
            <div key={s.title} style={{ display: 'flex', gap: 14, padding: '16px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA BANNER ── */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0d4a44 100%)', padding: '80px 6%' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px,4.5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-2.5px', marginBottom: 16, lineHeight: 1.08 }}>
            Ready to stop missing deadlines?
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.58)', marginBottom: 32, lineHeight: 1.75 }}>
            Join 200+ teams who run their work on Taska. Start free — no credit card needed.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="cta-primary"
              style={{ background: '#f97316', color: '#fff', padding: '16px 36px', borderRadius: 12, fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: '0 6px 28px rgba(249,115,22,0.52)', display: 'inline-block', letterSpacing: '-0.3px' }}>
              Start free trial — it&apos;s free →
            </Link>
            <Link href="/login" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '16px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.22)', display: 'inline-block', backdropFilter: 'blur(8px)' }}>
              Sign in instead
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 20 }}>
            ✓ 14-day free trial &nbsp;·&nbsp; ✓ No credit card &nbsp;·&nbsp; ✓ Cancel anytime
          </p>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0f172a', padding: '40px 6%', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>P</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Taska</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Privacy','Terms','Contact','Status'].map(l => (
              <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© 2025 Taska. Made in India 🇮🇳</div>
        </div>
      </footer>
    </div>
  )
}
