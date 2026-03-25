import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'

export default async function LandingPage() {
  // If already logged in → go straight to dashboard
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>P</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>Planora</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecoration: 'none', marginRight: 20 }}>Sign in</Link>
        <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Get started free</Link>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '90px 24px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(13,148,136,0.2)', border: '1px solid rgba(13,148,136,0.4)', borderRadius: 20, padding: '6px 14px', marginBottom: 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} />
          <span style={{ color: '#5eead4', fontSize: 13, fontWeight: 500 }}>Built for Indian teams · Razorpay billing · WhatsApp reminders</span>
        </div>

        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 24 }}>
          Project management<br />
          <span style={{ color: '#2dd4bf' }}>that actually works</span>
        </h1>

        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
          Manage projects, track time, automate recurring tasks, and get reminders on WhatsApp — all in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '14px 32px', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Start free → 
          </Link>
          <a href="#features" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '14px 32px', borderRadius: 10, fontSize: 16, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }}>
            See features
          </a>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 16 }}>No credit card required · Free forever for small teams</p>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { icon: '✅', title: 'Task management', desc: 'Asana-style tasks with priorities, due dates, assignees and bulk actions' },
            { icon: '📊', title: 'Kanban boards', desc: 'Visualise project work in To do / In progress / Review / Done columns' },
            { icon: '⏱', title: 'Time tracking', desc: 'Log billable and non-billable hours per project. Generate reports' },
            { icon: '🔁', title: 'Recurring tasks', desc: 'Daily, weekly, monthly — tasks auto-spawn on schedule without manual effort' },
            { icon: '🔔', title: 'WhatsApp reminders', desc: 'Get nudged on WhatsApp when tasks are overdue or due soon' },
            { icon: '💳', title: 'Razorpay billing', desc: 'Subscribe to Pro or Business plans via Razorpay in INR — no USD hassle' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '24px 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '0 24px 80px' }}>
        <div style={{ background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 20, padding: '48px 40px', maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Ready to get organised?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontSize: 15 }}>Join your team on Planora — free to start, no setup headaches.</p>
          <Link href="/login" style={{ background: '#0d9488', color: '#fff', padding: '14px 36px', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Create your workspace →
          </Link>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '0 0 32px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        © 2025 SNG Advisors · Planora · Made in India 🇮🇳
      </div>
    </div>
  )
}
