import Link from 'next/link'
import type { Metadata } from 'next'
import { TryupFloatSidebar } from './TryupFloatSidebar'

export const metadata: Metadata = {
  title: 'MSME Tracker — Automate Section 43B(h) Compliance | upFloat',
  description: 'Struggling to track MSME vendor payments and collect Udyam declarations? upFloat automates the entire process — reminders, forms, deadlines, and export. Start free.',
}

const TEAL  = '#0d9488'
const DARK  = '#0f172a'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'
const BG    = '#f8fafc'

export default function MsmeLandingPage() {
  return (
    <div style={{ background: '#ffffff', color: DARK, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", colorScheme: 'light' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0, background: '#ffffff', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>M</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: DARK }}>MSME Tracker</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 20, padding: '2px 8px' }}>by upFloat</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login?redirect=/msme" style={{ color: MUTED, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Login</Link>
          <Link href="/login?redirect=/msme&mode=signup" style={{ background: TEAL, color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes msme-orb-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.12); } }
          @keyframes msme-orb-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,40px) scale(0.9); } }
          @keyframes msme-orb-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,25px) scale(1.08); } }
          @keyframes msme-float { 0%,100% { opacity:0.10; } 50% { opacity:0.22; } }
          @keyframes msme-grid-fade { 0%,100% { opacity:0.04; } 50% { opacity:0.09; } }
          @keyframes msme-badge-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes msme-hero-in  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
          @keyframes msme-pulse-ring { 0% { transform:scale(1); opacity:0.5; } 70% { transform:scale(1.15); opacity:0; } 100% { transform:scale(1.15); opacity:0; } }
          .msme-hero-badge  { animation: msme-badge-in 0.5s ease forwards; }
          .msme-hero-h1     { animation: msme-hero-in  0.6s ease 0.1s both; }
          .msme-hero-p      { animation: msme-hero-in  0.6s ease 0.2s both; }
          .msme-hero-btns   { animation: msme-hero-in  0.6s ease 0.3s both; }
          .msme-mockup      { animation: msme-hero-in  0.7s ease 0.35s both; }
          .msme-stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(13,148,136,0.12) !important; transition: transform 0.2s, box-shadow 0.2s; }
          .msme-step-card:hover { border-color: rgba(13,148,136,0.4) !important; box-shadow: 0 4px 16px rgba(13,148,136,0.10) !important; transition: all 0.2s; }
          .msme-problem-card:hover { transform: translateY(-2px); transition: transform 0.2s; }
        `}</style>
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* Animated gradient orbs */}
          <div style={{ position: 'absolute', top: '-100px', left: '5%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.20) 0%, transparent 65%)', animation: 'msme-orb-1 9s ease-in-out infinite, msme-float 9s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '60px', right: '4%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 65%)', animation: 'msme-orb-2 12s ease-in-out infinite, msme-float 12s ease-in-out infinite 2s' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '40%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.10) 0%, transparent 65%)', animation: 'msme-orb-3 15s ease-in-out infinite, msme-float 15s ease-in-out infinite 4s' }} />
          {/* Subtle dot grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(13,148,136,0.35) 1px, transparent 1px)', backgroundSize: '28px 28px', animation: 'msme-grid-fade 6s ease-in-out infinite' }} />
        </div>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px 56px', textAlign: 'center', position: 'relative' }}>
          <div className="msme-hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: TEAL, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL, display: 'inline-block' }} />
            Section 43B(h) Compliance — fully automated
          </div>
          <h1 className="msme-hero-h1" style={{ fontSize: 'clamp(30px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.12, marginBottom: 20, letterSpacing: '-0.02em', color: DARK }}>
            Worried about<br/>
            <span style={{ color: TEAL }}>MSME compliance?</span><br/>
            <span style={{ fontSize: '0.70em', fontWeight: 600, color: MUTED }}>We have got you covered.</span>
          </h1>
          <p className="msme-hero-p" style={{ fontSize: 16, color: MUTED, lineHeight: 1.75, maxWidth: 560, margin: '0 auto 36px' }}>
            Stop chasing vendors manually. upFloat automates vendor follow-ups for MSME status and compliance documents — so you never have to ask twice. Every communication is logged in an audit-ready trail.
          </p>
          <div className="msme-hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <Link href="/login?redirect=/msme&mode=signup" style={{ background: TEAL, color: '#fff', borderRadius: 10, padding: '14px 32px', fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 14px rgba(13,148,136,0.35)' }}>Start free →</Link>
            <a href="#how-it-works" style={{ background: '#ffffff', color: DARK, borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none', border: `1px solid ${BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>See how it works</a>
          </div>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 56 }}>No subscription · Pay only to scale</p>

          {/* Product mockup */}
          <div className="msme-mockup" style={{ maxWidth: 720, margin: '0 auto', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(13,148,136,0.12)', background: '#fff', border: `1px solid ${BORDER}` }}>
            {/* Browser chrome */}
            <div style={{ background: '#f1f5f9', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fca5a5' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fde68a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#a7f3d0' }} />
              </div>
              <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>msme.upfloat.co/msme</div>
            </div>
            {/* Mock dashboard content */}
            <div style={{ padding: 20, textAlign: 'left' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 2 }}>MSME Vendor Tracker</div>
                  <div style={{ fontSize: 12, color: MUTED }}>Section 43B(h) compliance dashboard</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: TEAL, fontWeight: 600 }}>+ Add Vendor</div>
                  <div style={{ background: TEAL, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#fff', fontWeight: 600 }}>Send Emails</div>
                </div>
              </div>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Total Vendors', value: '24', color: TEAL },
                  { label: 'MSME Verified', value: '14', color: '#10b981' },
                  { label: 'Pending Reply', value: '7', color: '#f59e0b' },
                  { label: 'Not MSME', value: '3', color: '#64748b' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Table rows */}
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 14px', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, fontSize: 10, fontWeight: 700, color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>Vendor</span><span>Email</span><span>Status</span><span>Action</span>
                </div>
                {[
                  { name: 'Mehta Textiles Pvt Ltd', email: 'accounts@mehtax.in', status: 'Verified', statusColor: '#10b981', statusBg: '#d1fae5' },
                  { name: 'Ravi Auto Parts', email: 'ravi@autoparts.co', status: 'Pending', statusColor: '#d97706', statusBg: '#fef3c7' },
                  { name: 'Gupta Traders', email: 'info@guptatraders.in', status: 'Email Sent', statusColor: '#6366f1', statusBg: '#e0e7ff' },
                ].map((r, i) => (
                  <div key={r.name} style={{ padding: '9px 14px', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, alignItems: 'center', fontSize: 11, borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none', background: '#fff' }}>
                    <span style={{ fontWeight: 600, color: DARK }}>{r.name}</span>
                    <span style={{ color: MUTED }}>{r.email}</span>
                    <span style={{ background: r.statusBg, color: r.statusColor, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, display: 'inline-block' }}>{r.status}</span>
                    <span style={{ color: TEAL, fontWeight: 600, cursor: 'pointer', fontSize: 10 }}>Resend →</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '32px 24px', background: BG }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center' }}>
          {[
            { num: '100%', label: 'Automated — vendor emails, forms, and deadline tracking' },
            { num: '2 min', label: 'To onboard a vendor and send the first email' },
            { num: 'Full', label: 'Audit log ready to share with your CA or auditor' },
          ].map(s => (
            <div key={s.num} className="msme-stat-card" style={{ background: '#fff', borderRadius: 12, padding: '20px 16px', border: `1px solid ${BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'default' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: TEAL, marginBottom: 6 }}>{s.num}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem section */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 48px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 12, color: DARK }}>
          The problem every business faces
        </h2>
        <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 40, maxWidth: 540, margin: '0 auto 40px' }}>
          MSME tracking is simple in theory. In practice, doing it manually is a nightmare.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { title: 'Chasing vendors manually', body: "You need Udyam certificates from 50 vendors. You're sending messages manually, following up, waiting. Half don't reply." },
            { title: 'No central record', body: "You can't tell your auditor which vendors are MSME-registered and which aren't — it's all in scattered emails and WhatsApp chats." },
            { title: 'Missing deadlines silently', body: "Payment deadlines pass without any alert. You find out during filing that a deduction is disallowed — and you've already paid tax on it." },
          ].map(c => (
            <div key={c.title} className="msme-problem-card" style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: DARK }}>{c.title}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ background: BG, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '64px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: DARK }}>How it works</h2>
          <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 48 }}>Set up in under 5 minutes</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { step: '1', title: 'Add your vendors', body: 'Add vendors one by one or bulk-import from Excel. Just need the vendor name and email.' },
              { step: '2', title: 'Automated follow-ups', body: 'Each vendor gets an email with a simple form to confirm their Udyam number and MSME category.' },
              { step: '3', title: 'Export for filing', body: 'Download a clean Excel report with all vendor details, payment statuses, and Udyam numbers.' },
              { step: '4', title: 'Audit-ready log', body: 'A downloadable audit trail ready to hand to your auditor or share during scrutiny.' },
            ].map(s => (
              <div key={s.step} className="msme-step-card" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#fff' }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: DARK }}>{s.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore upFloat */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, padding: '48px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Are you a CA? Need a full practice management tool?
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, lineHeight: 1.3, color: DARK }}>
              Explore upFloat — task management, compliance, invoicing and more
            </h3>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              The same platform that powers MSME Tracker also manages tasks, recurring compliance deadlines, client portals, team collaboration, and invoicing — all in one place.
            </p>
          </div>
          <TryupFloatSidebar />
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: 'rgba(13,148,136,0.05)', borderTop: `1px solid rgba(13,148,136,0.15)`, padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: DARK }}>Start tracking today</h2>
        <p style={{ color: MUTED, fontSize: 15, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>Free to start. No subscription needed.</p>
        <Link href="/login?redirect=/msme&mode=signup" style={{ display: 'inline-block', background: TEAL, color: '#fff', borderRadius: 10, padding: '14px 36px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
          Get started free
        </Link>
        <p style={{ marginTop: 16, fontSize: 13, color: MUTED }}>
          Already have an account? <Link href="/login?redirect=/msme" style={{ color: TEAL, textDecoration: 'none' }}>Login</Link>
        </p>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: MUTED }}>© 2026 upFloat · MSME Tracker</div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <Link href="/privacy" style={{ color: MUTED, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms"   style={{ color: MUTED, textDecoration: 'none' }}>Terms</Link>
          <a href="mailto:info@upfloat.co" style={{ color: MUTED, textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>

    </div>
  )
}
