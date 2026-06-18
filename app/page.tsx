import { createClient }            from '@/lib/supabase/server'
import { redirect }                from 'next/navigation'
import Link                        from 'next/link'
import { headers }                 from 'next/headers'
import { getCountry, isValidCountry } from '@/lib/locale/countries'

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  // Detect country from IP for pricing display
  const hdrs        = await headers()
  const ipCountry   = hdrs.get('x-vercel-ip-country') ?? hdrs.get('cf-ipcountry') ?? ''
  const country     = getCountry(isValidCountry(ipCountry) ? ipCountry : null)
  const sym         = country.currencySymbol
  const starterP    = country.pricing.starter.monthly
  const proP        = country.pricing.pro.monthly
  const currName    = country.currency  // e.g. "INR", "USD"

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden',
      color: '#0f172a',
      colorScheme: 'light',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        /* ── Keyframes ───────────────────────────────────────────────────── */
        @keyframes shimmer {
          0%   { background-position: 200% center }
          100% { background-position: -200% center }
        }
        @keyframes gradient-x {
          0%,100% { background-position: 0% 50% }
          50%     { background-position: 100% 50% }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(28px) }
          to   { opacity: 1; transform: translateY(0)    }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px) }
          50%     { transform: translateY(-15px) }
        }
        @keyframes float-slow {
          0%,100% { transform: translateY(0px) rotate(0deg) }
          50%     { transform: translateY(-9px) rotate(3deg) }
        }
        @keyframes orb-drift {
          0%,100% { transform: translate(0px,0px) scale(1) }
          33%     { transform: translate(32px,-44px) scale(1.1) }
          66%     { transform: translate(-20px,26px) scale(0.92) }
        }
        @keyframes orb-drift-2 {
          0%,100% { transform: translate(0px,0px) scale(1) }
          33%     { transform: translate(-30px,40px) scale(0.88) }
          66%     { transform: translate(38px,-22px) scale(1.12) }
        }
        @keyframes orb-drift-3 {
          0%,100% { transform: translate(0px,0px) scale(1) }
          50%     { transform: translate(-24px,-32px) scale(1.06) }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.7 }
          100% { transform: scale(2.6); opacity: 0 }
        }
        @keyframes pulse-dot {
          0%,100% { transform: scale(1); opacity: 1 }
          50%     { transform: scale(1.55); opacity: 0.5 }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes marquee {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        @keyframes btn-shimmer {
          0%   { left: -110% }
          100% { left: 210%  }
        }
        @keyframes badge-float-1 {
          0%,100% { transform: translateY(0px) translateX(0px) }
          50%     { transform: translateY(-11px) translateX(4px) }
        }
        @keyframes badge-float-2 {
          0%,100% { transform: translateY(0px) }
          50%     { transform: translateY(-9px) }
        }
        @keyframes badge-float-3 {
          0%,100% { transform: translateY(0px) rotate(-1deg) }
          50%     { transform: translateY(-13px) rotate(1deg) }
        }
        @keyframes glow-breathe {
          0%,100% { box-shadow: 0 0 32px rgba(13,148,136,0.22), 0 8px 40px rgba(0,0,0,0.45) }
          50%     { box-shadow: 0 0 64px rgba(13,148,136,0.44), 0 8px 40px rgba(0,0,0,0.45) }
        }
        @keyframes hero-glow {
          0%,100% { opacity: 0.55 }
          50%     { opacity: 1 }
        }
        @keyframes diamond-spin {
          from { transform: rotate(45deg) }
          to   { transform: rotate(405deg) }
        }
        @keyframes diamond-spin-r {
          from { transform: rotate(45deg) }
          to   { transform: rotate(-315deg) }
        }
        @keyframes aurora-drift {
          0%,100% { transform: translateX(-18%) rotate(-7deg); opacity: 0.55 }
          50%     { transform: translateX(18%) rotate(-7deg);  opacity: 1    }
        }
        @keyframes aurora-drift-2 {
          0%,100% { transform: translateX(14%) rotate(5deg); opacity: 0.4 }
          50%     { transform: translateX(-22%) rotate(5deg); opacity: 0.8 }
        }
        @keyframes star-twinkle {
          0%,100% { opacity: 0.1;  transform: scale(0.7) }
          50%     { opacity: 0.95; transform: scale(1.7) }
        }
        @keyframes spotlight-sweep {
          0%,100% { opacity: 0.18; transform: translateX(-12%) }
          50%     { opacity: 0.32; transform: translateX(12%)  }
        }
        @keyframes word-in {
          from { opacity: 0; filter: blur(14px); transform: translateY(18px) }
          to   { opacity: 1; filter: blur(0px);  transform: translateY(0)    }
        }
        @keyframes ring-expand {
          0%   { transform: scale(0.82); opacity: 0.7 }
          100% { transform: scale(1.26); opacity: 0   }
        }

        /* ── Utility ─────────────────────────────────────────────────────── */
        .fade-up   { animation: fade-up 0.65s cubic-bezier(0.16,1,0.3,1) both }
        .fade-up-2 { animation: fade-up 0.65s 0.12s cubic-bezier(0.16,1,0.3,1) both }
        .fade-up-3 { animation: fade-up 0.65s 0.24s cubic-bezier(0.16,1,0.3,1) both }
        .fade-up-4 { animation: fade-up 0.65s 0.36s cubic-bezier(0.16,1,0.3,1) both }
        .fade-up-5 { animation: fade-up 0.65s 0.48s cubic-bezier(0.16,1,0.3,1) both }

        /* ── Nav ─────────────────────────────────────────────────────────── */
        .nav-link { transition: color 0.15s }
        .nav-link:hover { color: #0d9488 !important }

        /* ── CTA Buttons ─────────────────────────────────────────────────── */
        .btn-cta {
          position: relative; overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease !important;
        }
        .btn-cta::after {
          content: ''; position: absolute;
          top: 0; left: -110%; width: 55%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent);
          pointer-events: none;
        }
        .btn-cta:hover { transform: translateY(-2px) scale(1.025) !important }
        .btn-cta:hover::after { animation: btn-shimmer 0.55s ease forwards }
        .btn-cta-orange:hover { box-shadow: 0 18px 48px rgba(249,115,22,0.55) !important }
        .btn-cta-teal:hover   { box-shadow: 0 18px 48px rgba(13,148,136,0.55) !important }

        /* ── Pro button ──────────────────────────────────────────────────── */
        .btn-pro { transition: all 0.18s ease !important }
        .btn-pro:hover {
          background: #7c3aed !important; color: #fff !important;
          box-shadow: 0 4px 18px rgba(124,58,237,0.38) !important;
          border-color: #7c3aed !important;
        }

        /* ── Cards ───────────────────────────────────────────────────────── */
        .card-lift {
          transition: transform 0.26s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease;
        }
        .card-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.11) !important;
        }

        /* Gradient-border card on hover */
        .card-gb {
          position: relative; isolation: isolate;
          transition: transform 0.26s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease;
          background: #fff;
        }
        .card-gb::before {
          content: ''; position: absolute; inset: -1.5px;
          border-radius: inherit;
          background: linear-gradient(135deg, #0d9488 0%, #818cf8 50%, #f97316 100%);
          opacity: 0; transition: opacity 0.3s ease; z-index: -1;
        }
        .card-gb:hover::before { opacity: 1 }
        .card-gb:hover { transform: translateY(-5px); box-shadow: 0 22px 60px rgba(0,0,0,0.12) !important }

        /* ── Marquee ─────────────────────────────────────────────────────── */
        .marquee-wrap {
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
        }
        .marquee-track {
          display: flex; align-items: stretch; width: max-content; gap: 20px;
          animation: marquee 40s linear infinite;
        }
        .marquee-wrap:hover .marquee-track { animation-play-state: paused }

        /* ── Featured pricing card ───────────────────────────────────────── */
        .pricing-hero {
          position: relative; isolation: isolate;
          background: #fff !important;
        }
        .pricing-hero::before {
          content: ''; position: absolute; inset: -2px; border-radius: 20px;
          background: conic-gradient(
            from 0deg at 50% 50%,
            #0d9488 0%, #38bdf8 20%, #818cf8 40%, #f97316 60%, #2dd4bf 80%, #0d9488 100%
          );
          z-index: -1;
          animation: spin-slow 5s linear infinite;
        }

        /* ── Section chip labels ─────────────────────────────────────────── */
        .chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 14px 5px 8px; border-radius: 99px;
          font-size: 12px; font-weight: 700; letter-spacing: 0.03em;
          margin-bottom: 18px;
        }
        .chip-teal  { background: rgba(13,148,136,0.09); border: 1px solid rgba(13,148,136,0.22); color: #0d9488 }
        .chip-orange{ background: rgba(249,115,22,0.09); border: 1px solid rgba(249,115,22,0.22); color: #f97316 }
        .chip-violet{ background: rgba(124,58,237,0.09); border: 1px solid rgba(124,58,237,0.22); color: #7c3aed }
        .chip-slate { background: rgba(71,85,105,0.08);  border: 1px solid rgba(71,85,105,0.18);  color: #475569 }
        .chip-green { background: rgba(16,185,129,0.09); border: 1px solid rgba(16,185,129,0.22); color: #10b981 }
        .chip-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          animation: pulse-dot 2.2s ease-in-out infinite;
        }

        /* ── FAQ ─────────────────────────────────────────────────────────── */
        .faq-details summary { cursor: pointer; list-style: none; user-select: none }
        .faq-details summary::-webkit-details-marker { display: none }
        .faq-details[open] summary .faq-icon { transform: rotate(45deg) }
        .faq-details[open] summary { color: #0d9488 !important }
        .faq-icon { transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1); display: inline-block }
        .faq-details { transition: background 0.2s; border-radius: 12px !important; margin-bottom: 4px }
        .faq-details[open] { background: linear-gradient(135deg, rgba(13,148,136,0.04), rgba(56,189,248,0.04)) !important }

        /* ── Footer ──────────────────────────────────────────────────────── */
        .footer-link { transition: color 0.14s }
        .footer-link:hover { color: rgba(255,255,255,0.85) !important }

        /* ── Mobile nav (CSS-only, no JS) ───────────────────────────────── */
        .mnav { display: none; position: relative; margin-left: 4px; flex-shrink: 0 }
        .mnav summary {
          list-style: none; cursor: pointer; user-select: none;
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 10px;
          border: 1px solid #e2e8f0; background: #fff;
          transition: background 0.15s, border-color 0.15s;
        }
        .mnav summary::-webkit-details-marker { display: none }
        .mnav[open] summary { background: #f0fdfa; border-color: #99f6e4 }
        .mnav-bars { display: flex; flex-direction: column; gap: 4px }
        .mnav-bars span {
          display: block; width: 17px; height: 2px; border-radius: 2px;
          background: #334155; transition: transform 0.2s, opacity 0.2s;
        }
        .mnav[open] .mnav-bars span:nth-child(1) { transform: translateY(6px) rotate(45deg) }
        .mnav[open] .mnav-bars span:nth-child(2) { opacity: 0 }
        .mnav[open] .mnav-bars span:nth-child(3) { transform: translateY(-6px) rotate(-45deg) }
        .mnav-menu {
          position: absolute; right: 0; top: 50px; width: 240px;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
          box-shadow: 0 20px 56px rgba(0,0,0,0.16);
          padding: 8px; display: flex; flex-direction: column; gap: 1px; z-index: 200;
          animation: fade-up 0.22s cubic-bezier(0.16,1,0.3,1) both;
        }
        .mnav-menu a {
          padding: 12px 14px; font-size: 14px; font-weight: 600;
          color: #334155; text-decoration: none; border-radius: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .mnav-menu a:hover, .mnav-menu a:active { background: #f8fafc; color: #0d9488 }
        .mnav-menu .mnav-cta {
          margin-top: 6px; background: linear-gradient(135deg, #0d9488, #0891b2);
          color: #fff !important; justify-content: center; font-weight: 800;
          box-shadow: 0 2px 12px rgba(13,148,136,0.32);
        }
        .mnav-menu .mnav-cta:hover { background: linear-gradient(135deg, #0d9488, #0891b2); color: #fff }

        /* ── Responsive ──────────────────────────────────────────────────── */
        @media (max-width: 960px) {
          .hero-cols        { flex-direction: column !important; gap: 44px !important }
          .hero-visual      { align-self: auto !important; justify-content: center !important; width: 100% }
          .hero-visual > div { margin: 0 auto }
          .hero-left        { padding-bottom: 0 !important }
          .grid-3           { grid-template-columns: 1fr !important }
          .grid-4           { grid-template-columns: 1fr 1fr !important }
          .grid-2           { grid-template-columns: 1fr !important }
          .pricing-grid     { grid-template-columns: 1fr !important; max-width: 460px; margin: 0 auto }
          .footer-grid      { grid-template-columns: 1fr 1fr !important; gap: 36px !important }
          .lp-sec           { padding-top: 76px !important; padding-bottom: 76px !important }
          .msme-callout-grid { grid-template-columns: 1fr !important; gap: 28px !important }
          .compliance-sec-flex { gap: 24px !important }
        }
        @media (max-width: 760px) {
          .nav-mid     { display: none !important }
          .nav-signin  { display: none !important }
          .btn-pro     { display: none !important }
          .mnav        { display: block }
          .lp-nav      { gap: 12px !important; padding: 0 20px !important }
        }
        @media (max-width: 640px) {
          .lp-sec      { padding: 64px 20px !important }
          .lp-hero     { padding: 56px 20px 0 !important }
          .lp-cta      { padding: 76px 20px !important }
          .lp-security { padding: 72px 20px 0 !important }
          .lp-footer   { padding: 48px 20px 24px !important }
          .lp-testimonials { padding: 64px 0 !important }
          .lp-strip    { padding: 24px 20px !important }
          .hero-h1     { letter-spacing: -1.6px !important }
          .grid-4      { grid-template-columns: 1fr !important }
          .footer-grid { grid-template-columns: 1fr !important }
          .stats-row   { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 18px !important; width: 100% }
          .stats-row > div { padding: 0 !important; border-right: none !important }
          .steps-row   { grid-template-columns: 1fr !important; gap: 44px !important }
          .step-connector { display: none !important }
          .feature-hero-card { padding: 32px 24px !important }
          .sec-card    { padding: 28px 22px !important }
          .addon-card  { flex-direction: column !important; align-items: flex-start !important; gap: 18px !important; padding: 26px 22px !important }
          .addon-right { text-align: left !important }
          .addon-right > div:first-child { justify-content: flex-start !important }
          .compliance-grid { grid-template-columns: 1fr 1fr !important; min-width: 0 !important }
          .compliance-sec-flex { flex-direction: column !important; gap: 16px !important }
          .msme-callout-inner { padding: 32px 24px !important; border-radius: 18px !important }
          .marquee-card { width: 272px !important; padding: 24px 20px !important }
        }
        @media (max-width: 480px) {
          .lp-sec      { padding: 56px 16px !important }
          .lp-hero     { padding: 48px 16px 0 !important }
          .lp-cta      { padding: 64px 16px !important }
          .lp-security { padding: 60px 16px 0 !important }
          .lp-footer   { padding: 44px 16px 24px !important }
          .lp-strip    { padding: 22px 16px !important }
          .hero-ctas a, .cta-buttons a { display: block !important; width: 100% !important; text-align: center !important }
          .compliance-grid { grid-template-columns: 1fr !important }
          .hero-h1     { letter-spacing: -1.2px !important }
          .lp-nav      { padding: 0 14px !important }
          .nav-cta     { padding: 8px 14px !important; font-size: 13px !important }
          .msme-callout-inner { padding: 24px 18px !important; gap: 22px !important }
          .msme-callout-inner a { width: 100% !important; box-sizing: border-box !important }
        }
      `}</style>

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav className="lp-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 6%', height: 66, gap: 32,
        boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.04)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
          {/* Logo with animated pulse ring */}
          <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 10,
              background: 'rgba(13,148,136,0.2)',
              animation: 'pulse-ring 2.4s cubic-bezier(0,0,0.2,1) infinite',
            }}/>
            <div style={{
              position: 'relative', width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(13,148,136,0.38)',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8l3 3 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: '-0.6px', color: '#0f172a' }}>upFloat</span>
        </Link>

        <div className="nav-mid" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 28 }}>
          {[['Features','#features'],['Solutions','#solutions'],['Security','#security'],['Pricing','#pricing'],['Compare','#compare']].map(([l,h]) => (
            <a key={l} href={h} className="nav-link"
              style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/professionals" className="btn-pro"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: '#7c3aed', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              border: '1.5px solid #ddd6fe', borderRadius: 8, padding: '7px 14px',
              background: '#faf5ff',
            }}>
            <span style={{ fontSize: 14 }}>🏛️</span>
            <span className="nav-pro-btn">For Professionals</span>
          </Link>
          <Link href="/login" className="nav-link nav-signin"
            style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
          <Link href="/login" className="btn-cta btn-cta-teal nav-cta"
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              color: '#fff', padding: '9px 20px', borderRadius: 9,
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(13,148,136,0.32)', display: 'inline-block',
              letterSpacing: '-0.1px',
            }}>
            Start free →
          </Link>
          {/* Mobile hamburger — CSS-only, shown ≤760px */}
          <details className="mnav">
            <summary aria-label="Open menu">
              <span className="mnav-bars"><span/><span/><span/></span>
            </summary>
            <div className="mnav-menu">
              {[['Features','#features'],['Solutions','#solutions'],['Security','#security'],['Pricing','#pricing'],['Compare','#compare']].map(([l,h]) => (
                <a key={l} href={h}>{l}</a>
              ))}
              <a href="/professionals">🏛️ For Professionals</a>
              <a href="/login">Sign in</a>
              <a href="/login" className="mnav-cta">Start free →</a>
            </div>
          </details>
        </div>
      </nav>

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-hero" style={{
        background: 'linear-gradient(168deg, #05080f 0%, #0b1528 50%, #080d1a 100%)',
        padding: '96px 6% 0', position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(13,148,136,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(13,148,136,0.06) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 90% 75% at 50% 0%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 75% at 50% 0%, black 20%, transparent 100%)',
        }}/>

        {/* Animated orbs */}
        <div style={{
          position: 'absolute', top: -120, left: '18%', width: 680, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.16) 0%, transparent 65%)',
          animation: 'orb-drift 14s ease-in-out infinite', pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', top: 40, right: '12%', width: 440, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
          animation: 'orb-drift-2 18s ease-in-out infinite', pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', bottom: 80, left: '40%', width: 360, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.09) 0%, transparent 65%)',
          animation: 'orb-drift-3 22s ease-in-out infinite', pointerEvents: 'none',
        }}/>

        {/* ── Radial spotlight from top-center ── */}
        <div style={{
          position: 'absolute', top: -60, left: '30%', right: '30%', height: 420,
          background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(13,148,136,0.18) 0%, rgba(56,189,248,0.10) 40%, transparent 75%)',
          filter: 'blur(8px)',
          animation: 'spotlight-sweep 14s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Spinning gradient diamond — large, back-left ── */}
        <div style={{
          position: 'absolute', top: '8%', left: '-7%',
          width: 420, height: 420, borderRadius: 48,
          background: 'conic-gradient(from 0deg at 50% 50%, #0d9488 0%, #38bdf8 18%, #818cf8 38%, #f97316 58%, #2dd4bf 78%, #0d9488 100%)',
          opacity: 0.2,
          filter: 'blur(3px)',
          animation: 'diamond-spin 28s linear infinite',
          pointerEvents: 'none',
        }}/>
        {/* pulse rings around diamond 1 */}
        <div style={{
          position: 'absolute', top: '8%', left: '-7%',
          width: 420, height: 420, borderRadius: 48,
          border: '1.5px solid rgba(13,148,136,0.22)',
          animation: 'ring-expand 3.5s cubic-bezier(0,0,0.2,1) infinite',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', top: '8%', left: '-7%',
          width: 420, height: 420, borderRadius: 48,
          border: '1.5px solid rgba(56,189,248,0.18)',
          animation: 'ring-expand 3.5s 1.2s cubic-bezier(0,0,0.2,1) infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Spinning gradient diamond — medium, back-right ── */}
        <div style={{
          position: 'absolute', top: '28%', right: '-5%',
          width: 300, height: 300, borderRadius: 36,
          background: 'conic-gradient(from 180deg at 50% 50%, #818cf8 0%, #f97316 22%, #0d9488 48%, #38bdf8 72%, #818cf8 100%)',
          opacity: 0.16,
          filter: 'blur(2px)',
          animation: 'diamond-spin-r 20s linear infinite',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', top: '28%', right: '-5%',
          width: 300, height: 300, borderRadius: 36,
          border: '1.5px solid rgba(124,58,237,0.2)',
          animation: 'ring-expand 4s 0.6s cubic-bezier(0,0,0.2,1) infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Small accent diamond — bottom-right ── */}
        <div style={{
          position: 'absolute', bottom: '12%', left: '28%',
          width: 140, height: 140, borderRadius: 18,
          background: 'conic-gradient(from 90deg at 50% 50%, #2dd4bf 0%, #818cf8 50%, #f97316 100%)',
          opacity: 0.14,
          animation: 'diamond-spin 16s linear infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Aurora ribbon 1 ── */}
        <div style={{
          position: 'absolute', top: '32%', left: '-25%', right: '-25%', height: 90,
          background: 'linear-gradient(90deg, transparent 5%, rgba(13,148,136,0.07) 25%, rgba(56,189,248,0.13) 50%, rgba(124,58,237,0.07) 75%, transparent 95%)',
          filter: 'blur(28px)',
          animation: 'aurora-drift 13s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Aurora ribbon 2 ── */}
        <div style={{
          position: 'absolute', top: '55%', left: '-25%', right: '-25%', height: 70,
          background: 'linear-gradient(90deg, transparent 5%, rgba(249,115,22,0.06) 20%, rgba(56,189,248,0.10) 55%, rgba(13,148,136,0.07) 80%, transparent 95%)',
          filter: 'blur(22px)',
          animation: 'aurora-drift-2 17s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Twinkling star particles ── */}
        {([
          { top: '12%', left: '7%',  s: 3, d: '0s',    dur: 2.6 },
          { top: '22%', left: '32%', s: 2, d: '0.7s',  dur: 3.1 },
          { top: '48%', left: '12%', s: 2, d: '1.3s',  dur: 2.4 },
          { top: '65%', left: '22%', s: 3, d: '0.4s',  dur: 3.6 },
          { top: '18%', left: '62%', s: 2, d: '1.0s',  dur: 2.9 },
          { top: '35%', left: '78%', s: 3, d: '0.2s',  dur: 3.3 },
          { top: '72%', left: '70%', s: 2, d: '1.6s',  dur: 2.7 },
          { top: '28%', left: '88%', s: 2, d: '0.9s',  dur: 3.8 },
          { top: '58%', left: '50%', s: 3, d: '1.8s',  dur: 2.5 },
          { top: '42%', left: '92%', s: 2, d: '0.5s',  dur: 3.0 },
        ] as Array<{top:string,left:string,s:number,d:string,dur:number}>).map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: p.top, left: p.left,
            width: p.s, height: p.s,
            borderRadius: '50%',
            background: ['#2dd4bf','#818cf8','#38bdf8','#f97316','#fff'][i % 5],
            boxShadow: `0 0 ${p.s * 3}px 1px ${['rgba(45,212,191,0.8)','rgba(129,140,248,0.8)','rgba(56,189,248,0.8)','rgba(249,115,22,0.8)','rgba(255,255,255,0.6)'][i % 5]}`,
            animation: `star-twinkle ${p.dur}s ${p.d} ease-in-out infinite`,
            pointerEvents: 'none',
          }}/>
        ))}

        <div className="hero-cols" style={{
          maxWidth: 1120, margin: '0 auto',
          display: 'flex', alignItems: 'flex-start', gap: 64,
          position: 'relative', zIndex: 1,
        }}>
          {/* ── Left copy ── */}
          <div style={{ flex: '1 1 480px', paddingBottom: 96 }} className="fade-up hero-left">
            {/* Eyebrow chip */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 30,
              padding: '6px 14px 6px 8px', borderRadius: 99,
              background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.28)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0,
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}/>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, letterSpacing: '0.01em' }}>
                Professional teams · {currName} billing · Compliance included
              </span>
            </div>

            <h1 className="hero-h1" style={{
              fontSize: 'clamp(38px, 5.2vw, 66px)',
              fontWeight: 900, lineHeight: 1.02,
              letterSpacing: '-3px', margin: '0 0 22px', color: '#fff',
            }}>
              {['Task','management'].map((word, i) => (
                <span key={word} style={{
                  display: 'inline-block', marginRight: '0.22em',
                  animation: `word-in 0.75s ${i * 0.13}s cubic-bezier(0.16,1,0.3,1) both`,
                }}>{word}</span>
              ))}<br/>
              <span style={{
                background: 'linear-gradient(90deg, #2dd4bf 0%, #38bdf8 30%, #818cf8 65%, #2dd4bf 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'shimmer 5s linear infinite',
                display: 'inline',
              }}>
                {['built','for','professionals.'].map((word, i) => (
                  <span key={word} style={{
                    display: 'inline-block', marginRight: i < 2 ? '0.22em' : 0,
                    animation: `word-in 0.75s ${(i + 2) * 0.13}s cubic-bezier(0.16,1,0.3,1) both`,
                  }}>{word}</span>
                ))}
              </span>
            </h1>

            <p style={{
              fontSize: 18, color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.8, marginBottom: 38, maxWidth: 490,
              fontWeight: 400,
            }}>
              Tasks, approvals, recurring checklists, smart reminders, and professional compliance tools — in one platform designed for how accounting and advisory teams actually work.
            </p>

            <div className="hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <Link href="/login" className="btn-cta btn-cta-orange"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#fff', padding: '15px 34px', borderRadius: 11,
                  fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 24px rgba(249,115,22,0.45)', display: 'inline-block',
                  letterSpacing: '-0.2px',
                }}>
                Start free — no card needed
              </Link>
              <Link href="/professionals" style={{
                background: 'rgba(124,58,237,0.14)', color: '#c4b5fd',
                padding: '15px 24px', borderRadius: 11,
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                border: '1px solid rgba(124,58,237,0.28)', display: 'inline-block',
                transition: 'background 0.18s, border-color 0.18s',
              }}>
                🏛️ CPA / CA professionals →
              </Link>
            </div>

            {/* Social proof row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
                {['#0d9488','#7c3aed','#f97316','#0891b2','#16a34a'].map((c, i) => (
                  <div key={i} style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: `${c}22`, border: `2px solid ${c}`,
                    marginLeft: i === 0 ? 0 : -8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: c, zIndex: 5 - i,
                  }}>{'★'}</div>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.01em' }}>
                14-day free trial&nbsp;·&nbsp;Setup in 15 min&nbsp;·&nbsp;Cancel anytime
              </span>
            </div>
          </div>

          {/* ── Right: product preview ── */}
          <div className="hero-visual" style={{
            flex: '1 1 460px', display: 'flex',
            alignItems: 'flex-end', alignSelf: 'stretch',
          }}>
            {/* Floating badges */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
              <div style={{
                position: 'absolute', top: -28, right: -18, zIndex: 10,
                background: '#fff', borderRadius: 12,
                padding: '8px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'badge-float-1 4s ease-in-out infinite',
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Task approved</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Q3 Corp Tax — just now</div>
                </div>
              </div>

              <div style={{
                position: 'absolute', top: 120, left: -32, zIndex: 10,
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                borderRadius: 12, padding: '10px 14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                animation: 'badge-float-2 5.5s ease-in-out infinite',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>COMPLETION RATE</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>93%</div>
                <div style={{ fontSize: 10, color: '#818cf8' }}>↑ 28% this month</div>
              </div>

              <div style={{
                position: 'absolute', bottom: 60, right: -24, zIndex: 10,
                background: '#fff', borderRadius: 10,
                padding: '8px 12px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                display: 'flex', alignItems: 'center', gap: 7,
                animation: 'badge-float-3 6s ease-in-out infinite',
              }}>
                <span style={{ fontSize: 14 }}>🔁</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>Auto-spawned</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>12 recurring tasks</div>
                </div>
              </div>

              {/* Product window */}
              <div style={{
                width: '100%',
                background: '#fff', borderRadius: '18px 18px 0 0',
                boxShadow: '0 -12px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
                overflow: 'hidden',
                animation: 'glow-breathe 4s ease-in-out infinite',
              }}>
                {/* Browser chrome */}
                <div style={{ background: '#111827', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['#ff5f57','#febc2e','#28c840'].map(c => (
                      <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }}/>
                    ))}
                  </div>
                  <div style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 22,
                    display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }}/>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>upfloat.co/tasks</span>
                  </div>
                </div>
                {/* App bar */}
                <div style={{
                  background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                  padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>My Tasks</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>3 due today · 1 overdue</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['Overdue','#fef2f2','#dc2626','#fca5a5'],['Today','#f0fdfa','#0d9488','#5eead4'],['This week','#f8fafc','#64748b','#e2e8f0']].map(([t,bg,color,border]) => (
                      <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}` }}>{t}</span>
                    ))}
                  </div>
                </div>
                {/* Task list */}
                <div style={{ background: '#fff' }}>
                  {[
                    { title:'Q3 Corporation Tax Return',    status:'Overdue',        sc:'#dc2626', sb:'#fef2f2', av:'JR', avBg:'#fee2e2', avC:'#dc2626', due:'Oct 20', overdue:true  },
                    { title:'Client invoice review — Nov',  status:'Needs approval', sc:'#f97316', sb:'#fff7ed', av:'AM', avBg:'#ffedd5', avC:'#ea580c', due:'Today',  overdue:false },
                    { title:'VAT Return Q4 (MTD)',           status:'🔁 Recurring',  sc:'#7c3aed', sb:'#faf5ff', av:'KP', avBg:'#ede9fe', avC:'#7c3aed', due:'Nov 7',  overdue:false },
                    { title:'Payroll reconciliation',        status:'Done ✓',        sc:'#16a34a', sb:'#dcfce7', av:'JR', avBg:'#dcfce7', avC:'#16a34a', due:'Oct 18', done:true  },
                  ].map((task, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                      borderBottom: '1px solid #f8fafc',
                      background: (task as any).overdue ? '#fffbfb' : '#fff',
                    }}>
                      <div style={{
                        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                        background: (task as any).done ? '#0d9488' : 'transparent',
                        border: (task as any).done ? 'none' : `2px solid ${(task as any).overdue ? '#fca5a5' : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {(task as any).done && <span style={{ color: '#fff', fontSize: 7, fontWeight: 800 }}>✓</span>}
                      </div>
                      <span style={{
                        flex: 1, fontSize: 12, fontWeight: 500, minWidth: 0,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        color: (task as any).done ? '#94a3b8' : '#0f172a',
                        textDecoration: (task as any).done ? 'line-through' : 'none',
                      }}>{task.title}</span>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: task.avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: task.avC, flexShrink: 0 }}>{task.av}</div>
                      <span style={{ fontSize: 10, color: (task as any).overdue ? '#dc2626' : '#94a3b8', fontWeight: (task as any).overdue ? 700 : 400, flexShrink: 0 }}>{task.due}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: task.sb, color: task.sc, flexShrink: 0, whiteSpace: 'nowrap' }}>{task.status}</span>
                    </div>
                  ))}
                </div>
                {/* Notification banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                  borderTop: '1px solid #ddd6fe',
                  padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>🔔</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#6d28d9' }}>Reminder sent to JR</div>
                    <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 1 }}>Corp Tax was due today — escalated to manager</div>
                  </div>
                  <span style={{ fontSize: 9, color: '#a78bfa', flexShrink: 0, fontWeight: 600 }}>Just now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TRUST STRIP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-strip" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '28px 6%' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
          <div className="stats-row" style={{ display: 'flex', gap: 0 }}>
            {[
              { v: '500+', l: 'professional teams', color: '#0d9488' },
              { v: `${sym}${starterP.toLocaleString()}`,  l: 'flat team pricing from', color: '#f97316' },
              { v: '5',    l: 'countries supported', color: '#7c3aed' },
              { v: '99.9%',l: 'uptime SLA', color: '#0891b2' },
            ].map(({ v, l, color }, i) => (
              <div key={l} style={{
                padding: '0 36px', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{
                  fontSize: 22, fontWeight: 900, letterSpacing: '-0.8px',
                  background: `linear-gradient(135deg, ${color}, ${color}bb)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{v}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Trusted by</span>
            {['CA / CPA firms','Agencies','Operations','Legal teams','Startups'].map(t => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 700, color: '#475569',
                background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: 99,
              }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COUNTRY BADGES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-strip" style={{ background: '#fff', padding: '20px 6%' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginRight: 4 }}>Serving professionals in</span>
          {[['🇺🇸','United States'],['🇬🇧','United Kingdom'],['🇨🇦','Canada'],['🇦🇺','Australia'],['🇪🇺','Europe']].map(([flag, name]) => (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 700, color: '#334155',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              padding: '5px 13px', borderRadius: 99,
            }}>
              {flag} {name}
            </span>
          ))}
        </div>
      </section>

      {/* ━━━ 3 KEY DIFFERENTIATORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec" style={{ padding: '96px 6%', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="chip chip-teal">
              <span className="chip-dot" style={{ background: '#0d9488' }}/>
              Why practices choose upFloat
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.06, margin: '0 0 16px', color: '#0f172a' }}>
              Everything generic tools miss<br/>for professional practices
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>
              Most task tools were designed for tech teams. upFloat was built for how accounting and advisory businesses actually operate.
            </p>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                icon: '📋',
                color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', glow: 'rgba(22,163,74,0.12)',
                title: 'Approval workflows',
                body: 'Staff submit work for manager sign-off. One-click approve or return with note. Every decision logged with timestamp — full audit trail for compliance.',
                tag: 'Full audit trail',
              },
              {
                icon: '💰',
                color: '#f97316', bg: '#fff7ed', border: '#fed7aa', glow: 'rgba(249,115,22,0.12)',
                title: `Flat ${currName} pricing`,
                body: `From ${sym}${starterP.toLocaleString()}/month for your whole team — not per person like typical project tools. One predictable bill. No per-user upsell traps. Cancel anytime.`,
                tag: 'No per-user fees',
              },
              {
                icon: '🏛️',
                color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', glow: 'rgba(124,58,237,0.12)',
                title: 'Professional compliance built-in',
                body: 'Pre-built compliance task templates for US, UK, Canada, Australia and Europe. Auto-creates document subtasks and tracks deadlines by country.',
                tag: 'US · UK · CA · AU · EU',
              },
            ].map((d, i) => (
              <div key={i} className="card-gb" style={{
                borderRadius: 18, padding: '34px 30px',
                border: '1px solid #f1f5f9', boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: d.bg, border: `1px solid ${d.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, marginBottom: 20,
                  boxShadow: `0 4px 16px ${d.glow}`,
                }}>{d.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 10, color: '#0f172a' }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, marginBottom: 20 }}>{d.body}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 800, color: d.color,
                  background: d.bg, border: `1px solid ${d.border}`,
                  borderRadius: 99, padding: '4px 12px',
                }}>✓ {d.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="features" className="lp-sec" style={{ padding: '96px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="chip chip-orange">
              <span className="chip-dot" style={{ background: '#f97316' }}/>
              Core capabilities
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.06, margin: '0 0 16px', color: '#0f172a' }}>
              Six features your team uses<br/>every single day
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 440, margin: '0 auto', lineHeight: 1.75 }}>
              Not features for the sake of features. Tools that close tasks, enforce accountability, and give you real visibility.
            </p>
          </div>

          {/* 2 large hero feature cards */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="feature-hero-card" style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              borderRadius: 22, padding: '44px 38px', color: '#fff', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }}/>
              <div style={{ position: 'absolute', bottom: -40, left: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }}/>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>Automation</div>
              <h3 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', marginBottom: 14, lineHeight: 1.15 }}>Recurring tasks,<br/>zero effort</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, marginBottom: 26, maxWidth: 320 }}>
                Set any task to repeat daily, weekly, monthly, or quarterly. upFloat creates it, assigns it, and starts the clock automatically.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Daily','Weekly','Monthly','Quarterly','Annual'].map(f => (
                  <span key={f} style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, padding: '5px 13px', color: 'rgba(255,255,255,0.95)' }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="feature-hero-card" style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%)',
              borderRadius: 22, padding: '44px 38px', color: '#fff', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }}/>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(167,139,250,0.7)', marginBottom: 14 }}>Workflow</div>
              <h3 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.8px', marginBottom: 14, lineHeight: 1.15 }}>Approval in one click,<br/>full audit trail</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 26, maxWidth: 320 }}>
                Staff submit work for manager sign-off. Approve or return with one click. Every decision is logged with timestamp and comment.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, background: '#dcfce7', color: '#16a34a', borderRadius: 99, padding: '5px 13px' }}>Approved ✓</span>
                <span style={{ fontSize: 12, fontWeight: 800, background: '#fef2f2', color: '#dc2626', borderRadius: 99, padding: '5px 13px' }}>Returned with note</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '5px 13px' }}>Full audit log</span>
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
                background: '#fff', borderRadius: 16, padding: '26px 22px',
                border: '1px solid #f1f5f9', boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.3px', color: '#0f172a' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.68, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec" style={{ padding: '96px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="chip chip-teal">
              <span className="chip-dot" style={{ background: '#0d9488' }}/>
              Three steps to get started
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#0f172a' }}>
              Up and running in 15 minutes
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 360, margin: '0 auto', lineHeight: 1.75 }}>
              No onboarding call. No 40-field setup. Just start.
            </p>
          </div>

          <div className="steps-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
            <div className="step-connector" style={{ position: 'absolute', top: 44, left: '18%', right: '18%', height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0 15%, #e2e8f0 85%, transparent)', zIndex: 0 }}/>
            {[
              { n: '01', title: 'Invite your team', body: 'Add members, assign roles — owner, manager, member, viewer. Done in under 2 minutes.' },
              { n: '02', title: 'Create & assign tasks', body: 'Add tasks manually, use templates, or let upFloat auto-generate compliance tasks for your practice from pre-built country templates.' },
              { n: '03', title: 'Stay accountable automatically', body: 'upFloat sends smart reminders, tracks completion, escalates blockers — without anyone manually chasing anyone.' },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 30px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 88, height: 88, borderRadius: '50%', margin: '0 auto 26px', position: 'relative',
                  background: i === 1 ? 'linear-gradient(135deg, #0d9488, #0891b2)' : '#fff',
                  border: i === 1 ? 'none' : '2px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: i === 1 ? '0 8px 32px rgba(13,148,136,0.36)' : '0 2px 10px rgba(0,0,0,0.06)',
                }}>
                  {i === 1 && <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1px solid rgba(13,148,136,0.25)', animation: 'pulse-ring 2.8s ease-in-out infinite' }}/>}
                  <span style={{ fontSize: 22, fontWeight: 900, color: i === 1 ? '#fff' : '#0d9488', letterSpacing: '-0.5px' }}>{step.n}</span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 10, color: '#0f172a' }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.72, maxWidth: 250, margin: '0 auto' }}>{step.body}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 52 }}>
            <Link href="/login" className="btn-cta btn-cta-orange"
              style={{
                display: 'inline-block', background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff', padding: '14px 34px', borderRadius: 11,
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 22px rgba(249,115,22,0.4)',
              }}>
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ SOLUTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="solutions" className="lp-sec" style={{ padding: '96px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="chip chip-orange">
              <span className="chip-dot" style={{ background: '#f97316' }}/>
              Works for your practice type
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#0f172a' }}>
              Built for every professional team type
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 380, margin: '0 auto', lineHeight: 1.75 }}>
              upFloat adapts to your workflow — not the other way around.
            </p>
          </div>

          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              {
                icon:'🏛️', color:'#f97316', bg:'#fff7ed', border:'#fed7aa',
                title:'CPA & Accounting',
                features:['Country compliance templates', 'US · UK · CA · AU · EU tasks', 'Document upload enforcement', 'Statutory deadline tracking'],
                link: '/professionals', linkLabel: 'See compliance module →',
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
                background: '#fff', borderRadius: 18, padding: '28px 22px',
                border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: u.bg, border: `1px solid ${u.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{u.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: '#0f172a', letterSpacing: '-0.3px' }}>{u.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {u.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#64748b' }}>
                      <span style={{ color: u.color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                {u.link && (
                  <Link href={u.link} style={{ fontSize: 12, fontWeight: 800, color: u.color, textDecoration: 'none' }}>{u.linkLabel}</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COMPARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="compare" className="lp-sec" style={{ padding: '96px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="chip chip-slate">
              <span className="chip-dot" style={{ background: '#475569' }}/>
              Side by side
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#0f172a' }}>
              Why professional teams switch to upFloat
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 460, margin: '0 auto', lineHeight: 1.75 }}>
              Compliance-aware, flat-priced, with features professional practices actually need.
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 20, boxShadow: '0 4px 28px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ padding: '20px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', width: '34%' }}>Feature</th>
                  <th style={{ padding: '20px 16px', textAlign: 'center', background: '#0a0f1e', borderBottom: '2px solid #0d9488', minWidth: 110 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#0d9488,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', boxShadow: '0 2px 8px rgba(13,148,136,0.4)' }}>F</div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>upFloat</span>
                      <span style={{ fontSize: 10, color: '#2dd4bf', fontWeight: 700 }}>{sym}{starterP.toLocaleString()}/mo</span>
                    </div>
                  </th>
                  {[['Asana','$13.49/user'],['Monday','$12/user'],['ClickUp','$10/user']].map(([name, price]) => (
                    <th key={name} style={{ padding: '20px 16px', textAlign: 'center', background: '#fafaf9', borderBottom: '1px solid #e2e8f0', minWidth: 100 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature:'Flat team pricing (not per-user)',    taska:true,  asana:false, mon:false, cu:false, usp:true  },
                  { feature:'Country compliance templates',        taska:true,  asana:false, mon:false, cu:false, usp:true  },
                  { feature:'Multi-country task libraries',        taska:true,  asana:false, mon:false, cu:false, usp:true  },
                  { feature:'Approval workflows + audit trail',    taska:true,  asana:true,  mon:true,  cu:true,  usp:false },
                  { feature:'Recurring task automation',           taska:true,  asana:true,  mon:'partial', cu:true, usp:false },
                  { feature:'Time tracking',                       taska:true,  asana:true,  mon:true,  cu:true,  usp:false },
                  { feature:'Client management',                   taska:true,  asana:false, mon:false, cu:false, usp:true  },
                  { feature:'Document upload enforcement',         taska:true,  asana:false, mon:false, cu:false, usp:true  },
                  { feature:'Reports & CSV export',                taska:true,  asana:true,  mon:true,  cu:true,  usp:false },
                  { feature:'Role-based permissions',              taska:true,  asana:true,  mon:true,  cu:true,  usp:false },
                ].map((row, i) => {
                  const bg = i % 2 === 0 ? '#fff' : '#fafafa'
                  function Cell({ val, hl }: { val: boolean | string; hl?: boolean }) {
                    return (
                      <td style={{ padding: '13px 16px', textAlign: 'center', background: hl ? 'rgba(13,148,136,0.04)' : bg, borderBottom: '1px solid #f1f5f9' }}>
                        {val === true  ? <span style={{ fontSize: 16 }}>✅</span>
                        : val === false ? <span style={{ fontSize: 14, color: '#e2e8f0' }}>—</span>
                        : <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 99 }}>Partial</span>}
                      </td>
                    )
                  }
                  return (
                    <tr key={row.feature}>
                      <td style={{ padding: '13px 24px', fontSize: 13, fontWeight: row.usp ? 700 : 400, color: '#374151', background: bg, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {row.feature}
                          {row.usp && <span style={{ fontSize: 9, fontWeight: 800, background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa', padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Pro-first</span>}
                        </span>
                      </td>
                      <Cell val={row.taska} hl />
                      <Cell val={row.asana} />
                      <Cell val={row.mon} />
                      <Cell val={row.cu} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ━━━ PRICING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="pricing" className="lp-sec" style={{ padding: '96px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="chip chip-violet">
              <span className="chip-dot" style={{ background: '#7c3aed' }}/>
              Simple, flat pricing
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#0f172a' }}>
              Simple pricing, billed in {currName}
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 380, margin: '0 auto', lineHeight: 1.75 }}>
              Flat team pricing — not per user. Start free and upgrade when you grow.
            </p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
            {[
              {
                name:'Free', price:'0', period:'', color:'#64748b', bg:'#fff', border:'#e2e8f0',
                primary:false, cta:'Start free',
                features:['Up to 5 members','3 active projects','Unlimited tasks','Smart reminders (basic)','Task comments & activity'],
              },
              {
                name:'Starter', price:starterP.toLocaleString(), period:'/mo', color:'#0d9488', bg:'#fff', border:'#0d9488',
                badge:'Most popular', primary:true, cta:'Start free trial',
                features:['Up to 15 members','15 projects','Recurring task automation','Approval workflows','Time tracking','Reports & CSV export'],
              },
              {
                name:'Pro', price:proP.toLocaleString(), period:'/mo', color:'#7c3aed', bg:'#fff', border:'#ddd6fe',
                primary:false, cta:'Start free trial',
                features:['Up to 50 members','Unlimited projects','Compliance module (all countries)','Custom fields & templates','API access','Priority support'],
              },
            ].map((plan) => (
              <div key={plan.name}
                className={plan.primary ? 'pricing-hero' : ''}
                style={{
                  background: plan.bg,
                  border: plan.primary ? 'none' : `1.5px solid ${plan.border}`,
                  borderRadius: 18, padding: '30px 26px', position: 'relative',
                  boxShadow: plan.primary ? '0 12px 40px rgba(13,148,136,0.18)' : '0 2px 10px rgba(0,0,0,0.04)',
                }}>
                {(plan as any).badge && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(13,148,136,0.4)' }}>{(plan as any).badge}</div>
                )}
                <div style={{ fontSize: 11, fontWeight: 800, color: plan.primary ? plan.color : '#64748b', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 24 }}>
                  {plan.price !== '0' && <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>{sym}</span>}
                  <span style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: '-2px' }}>{plan.price === '0' ? 'Free' : plan.price}</span>
                  {plan.period && <span style={{ fontSize: 13, color: '#94a3b8' }}>{plan.period}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#374151' }}>
                      <span style={{ color: plan.primary ? plan.color : '#94a3b8', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link href="/login" className={plan.primary ? 'btn-cta btn-cta-teal' : ''} style={{
                  display: 'block', textAlign: 'center', padding: '12px 16px', borderRadius: 11,
                  background: plan.primary ? 'linear-gradient(135deg, #0d9488, #0891b2)' : 'transparent',
                  color: plan.primary ? '#fff' : plan.color,
                  border: plan.primary ? 'none' : `1.5px solid ${plan.color}`,
                  fontSize: 14, fontWeight: 800, textDecoration: 'none',
                  boxShadow: plan.primary ? '0 4px 18px rgba(13,148,136,0.32)' : 'none',
                  transition: 'all 0.18s ease',
                }}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 24 }}>
            All plans include 14-day free trial · No credit card required · Cancel anytime · Billed in {currName}
          </p>

          {/* Professional Setup */}
          <div className="addon-card" style={{
            marginTop: 36, borderRadius: 18, padding: '30px 34px',
            background: '#fff', border: '1px solid #e2e8f0',
            boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: 18, flexShrink: 0,
              background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
              border: '1px solid #fed7aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>🚀</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Professional Setup &amp; Onboarding
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 99, background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>One-time</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.72, margin: 0, maxWidth: 560 }}>
                A dedicated onboarding expert migrates your data, configures country-specific compliance templates, trains your team, and ensures you go live without disruption.
              </p>
              <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                {['Data migration','Compliance template setup','Team training session','Priority go-live support'].map(f => (
                  <span key={f} style={{ fontSize: 12, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                    <span style={{ fontWeight: 800 }}>✓</span> {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="addon-right" style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>$</span>
                <span style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: '-2px' }}>499</span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>one-time · any plan</div>
              <Link href="/login" className="btn-cta btn-cta-orange" style={{
                display: 'inline-block', padding: '10px 22px', borderRadius: 10,
                background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
                fontSize: 13, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 3px 16px rgba(249,115,22,0.38)',
              }}>
                Get started →
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div className="addon-card" style={{
            marginTop: 16, borderRadius: 18, padding: '30px 34px',
            background: 'linear-gradient(135deg, #080c18 0%, #0b1528 100%)',
            border: '1px solid rgba(13,148,136,0.24)',
            boxShadow: '0 4px 28px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, flexShrink: 0, background: 'rgba(13,148,136,0.14)', border: '1px solid rgba(13,148,136,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔐</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>Private Cloud / Self-Hosted</span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 99, background: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Enterprise</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.72, margin: 0, maxWidth: 560 }}>
                For data-sensitive organisations — banks, regulated advisories, and enterprises — that need all data to stay exclusively on their own infrastructure with zero cloud dependency.
              </p>
              <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                {['Your servers · your DB','Zero cloud dependency','Compliance-ready','Dedicated deployment support'].map(f => (
                  <span key={f} style={{ fontSize: 12, color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                    <span style={{ fontWeight: 800 }}>✓</span> {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="addon-right" style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginBottom: 4 }}>Custom pricing</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 14 }}>based on team size &amp; infra</div>
              <a href="mailto:hello@upfloat.co?subject=Enterprise%20Inquiry" className="btn-cta btn-cta-teal" style={{
                display: 'inline-block', padding: '10px 22px', borderRadius: 10,
                background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: '#fff',
                fontSize: 13, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 3px 16px rgba(13,148,136,0.42)',
              }}>
                Talk to us →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TESTIMONIALS — auto-scroll marquee ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="testimonials" className="lp-testimonials" style={{ padding: '96px 0', background: '#fff', borderTop: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', padding: '0 6%', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-1.2px', margin: '0 0 12px', color: '#0f172a' }}>
            Teams who made the switch
          </h2>
          <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7 }}>What early users say after one month on upFloat.</p>
        </div>

        {/* Marquee */}
        <div className="marquee-wrap" style={{ padding: '8px 0' }}>
          <div className="marquee-track">
            {/* Duplicate the cards twice for seamless loop */}
            {[...Array(2)].map((_, pass) =>
              [
                { init:'JM', color:'#f97316', name:'James M.', role:'Managing Partner', co:'CPA firm, Chicago', quote:'We replaced three separate tools with upFloat. The compliance templates for US federal and state returns saved us hours of setup. The approval flow is exactly what our practice needed.', metric:'3 tools → 1 platform' },
                { init:'SR', color:'#0d9488', name:'Sophie R.', role:'Director', co:'Accounting firm, London', quote:'Task completion jumped from 65% to 93% in six weeks. The VAT MTD templates were ready out of the box. Our managers finally have visibility without chasing everyone manually.', metric:'65% → 93% completion' },
                { init:'LK', color:'#7c3aed', name:'Liam K.', role:'Head of Ops', co:'Agency, Toronto', quote:'Setup took 20 minutes. Flat USD pricing was a no-brainer versus Monday.com at $12 per person. Client management, approvals, and time tracking finally in one place.', metric:'ROI in week 1' },
                { init:'AM', color:'#0891b2', name:'Ananya M.', role:'Partner', co:'CA firm, Mumbai', quote:'The Indian compliance templates saved us days of setup. GST, TDS, ITR all pre-built. Our team went from spreadsheets to a fully organised system in under a week.', metric:'Week 1 payback' },
                { init:'PW', color:'#16a34a', name:'Paul W.', role:'COO', co:'Operations, Sydney', quote:'We run 60+ recurring checklists across 5 departments. upFloat handles every spawn, every reminder, every escalation — without a single Slack chase message from me anymore.', metric:'60 checklists automated' },
              ].map((t, i) => (
                <div key={`${pass}-${i}`} className="marquee-card" style={{
                  background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 18,
                  padding: '28px 26px', width: 320, flexShrink: 0,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                    {'★★★★★'.split('').map((s, j) => <span key={j} style={{ color: '#fbbf24', fontSize: 14 }}>{s}</span>)}
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.75, marginBottom: 14, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                  <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: t.color, background: '#fff', border: `1.5px solid ${t.color}28`, borderRadius: 99, padding: '3px 11px', marginBottom: 18 }}>{t.metric}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${t.color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: t.color, flexShrink: 0 }}>{t.init}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.role} · {t.co}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ━━━ SECURITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="security" className="lp-security" style={{ padding: '100px 6% 0', background: '#07090f', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(16,185,129,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.05) 1px,transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: -120, right: '10%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)', animation: 'orb-drift 20s ease-in-out infinite', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: 0, left: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 65%)', animation: 'orb-drift-2 25s ease-in-out infinite', pointerEvents: 'none' }}/>

        <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="chip chip-green" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
              <span className="chip-dot" style={{ background: '#10b981' }}/>
              Data privacy &amp; international trust
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1.06, margin: '0 0 18px' }}>
              Your clients trust you<br/>with their financials.<br/>
              <span style={{
                background: 'linear-gradient(90deg, #10b981, #2dd4bf)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>We protect that trust.</span>
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.42)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
              upFloat is built for accounting and advisory firms that handle sensitive client data across multiple jurisdictions. Security is not a checkbox — it is the foundation.
            </p>
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="sec-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '38px 34px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 22 }}>Architecture</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { icon: '🔒', title: 'Complete org isolation', body: 'Every organisation is a completely separate data silo. There is no data commingling — your client records, tasks, and documents are inaccessible to any other account on the platform.' },
                  { icon: '🔐', title: 'AES-256 + TLS 1.3 encryption', body: 'All data is encrypted at rest with AES-256 and in transit with TLS 1.3. Encryption is enforced at every layer — database, storage, and API.' },
                  { icon: '🕵️', title: 'Zero data mining, ever', body: 'We do not analyse, profile, sell, or share your client data with any third party. Your data is used exclusively to run your upFloat account — nothing else.' },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 5, letterSpacing: '-0.2px' }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.72 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sec-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '38px 34px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 22 }}>Accountability</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { icon: '📋', title: 'Immutable audit trail', body: 'Every action — task update, approval, login, permission change — is logged with timestamp, user identity, and IP address. Suitable for compliance reviews and client-side audits.' },
                  { icon: '🎛️', title: 'Granular role-based access', body: 'Owner, admin, manager, member, viewer. Each role has precise permissions. Staff see only what they need. No accidental data exposure across clients or teams.' },
                  { icon: '📤', title: 'Your data, always yours', body: 'Export everything in standard formats at any time. Request complete deletion at any time — including all backups. No lock-in, no hostage data, no delay.' },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 5, letterSpacing: '-0.2px' }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.72 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance standards */}
          <div className="sec-card" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 22, padding: '34px 38px', marginBottom: 16 }}>
            <div className="compliance-sec-flex" style={{ display: 'flex', alignItems: 'flex-start', gap: 44, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>International standards</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, maxWidth: 260 }}>
                  upFloat is designed to operate in compliance with privacy regulations across every jurisdiction we serve.
                </div>
              </div>
              <div className="compliance-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, minWidth: 0 }}>
                {[
                  { label: 'GDPR',        sub: 'EU / EEA',       color: '#60a5fa' },
                  { label: 'CCPA',        sub: 'California, USA', color: '#f97316' },
                  { label: 'PIPEDA',      sub: 'Canada',          color: '#f87171' },
                  { label: 'Privacy Act', sub: 'Australia',       color: '#4ade80' },
                  { label: 'UK GDPR',     sub: 'United Kingdom',  color: '#a78bfa' },
                  { label: 'SOC 2',       sub: 'In progress',     color: '#94a3b8' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: s.color, letterSpacing: '-0.4px' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingBottom: 100 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 30px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>🌍 &nbsp;Global infrastructure</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.78, margin: '0 0 16px' }}>
                Hosted on AWS enterprise infrastructure. Data can be regionally isolated for enterprise plans — EU-only, US-only, or APAC-only hosting available on request.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['AWS infrastructure','99.9% uptime SLA','Automated backups','Disaster recovery'].map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)', padding: '3px 10px', borderRadius: 99 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(13,148,136,0.08) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 18, padding: '28px 30px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>🔐 &nbsp;Private cloud / self-hosted</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.78, margin: '0 0 16px' }}>
                For banks, regulated advisories, and data-sensitive enterprises that require all data to remain on their own infrastructure — with zero third-party cloud dependency.
              </p>
              <a href="mailto:hello@upfloat.co?subject=Private+Cloud+Inquiry" style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', textDecoration: 'none' }}>
                Enquire about private deployment →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec" style={{ padding: '96px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 900, letterSpacing: '-1.2px', margin: '0 0 12px', color: '#0f172a' }}>Questions we always get</h2>
            <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7 }}>Quick answers. No sales call required.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { q: 'Does my team need to install anything?', a: 'Nothing. upFloat is fully web-based — any browser, any device. Smart reminders work via email and in-app notifications with no installation required.' },
              { q: 'How are compliance templates organised by country?', a: 'In the Compliance module, you load task templates for your service countries — US, UK, Canada, Australia, or Europe. Each country has pre-built tasks (e.g. Form 941 for US, VAT MTD returns for UK, BAS for Australia) that you can load, customise, and assign to clients in bulk.' },
              { q: 'How is upFloat different from Asana or Monday.com?', a: "Those tools are designed for general teams. upFloat is built specifically for accounting and advisory practices: flat USD team pricing (not $12–$14 per person), built-in compliance templates per country, client management, document upload enforcement, and approval workflows with full audit trails." },
              { q: 'Where is our data stored, and who can access it?', a: 'Your data is hosted on AWS enterprise infrastructure. Each organisation is a fully isolated silo — no other upFloat account can access your data under any circumstances. Our team can only access infrastructure-level metrics (no task or client content) and only for incident resolution, with a logged access request. For EU practices, EU-region hosting is available on Pro and Enterprise plans.' },
              { q: 'Is upFloat GDPR compliant? What about CCPA and PIPEDA?', a: 'upFloat is designed to align with GDPR (EU/EEA), UK GDPR, CCPA (California), and PIPEDA (Canada). We offer a Data Processing Agreement (DPA) for business customers. You can request deletion of all your data at any time, and we will action it within 30 days including all backup copies.' },
              { q: 'Can I try before paying?', a: 'Yes. The Free plan is free forever for up to 5 people. All paid plans include a 14-day free trial — no credit card required to start.' },
              { q: 'What happens if I cancel?', a: "Cancel any time from your billing settings. You keep access until the end of your billing period. You can export all your data at any time. No lock-in." },
              { q: 'Do you support multiple countries for the same practice?', a: 'Yes. If your practice serves clients in multiple jurisdictions, you can load compliance templates from several countries simultaneously — tasks are prefixed by country code so they stay clearly organised.' },
            ].map((faq, i) => (
              <details key={i} className="faq-details" style={{ borderBottom: '1px solid #f1f5f9', background: 'transparent' }}>
                <summary style={{
                  padding: '20px 16px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16,
                  fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px',
                }}>
                  {faq.q}
                  <span className="faq-icon" style={{ fontSize: 22, color: '#94a3b8', flexShrink: 0, fontWeight: 300, lineHeight: 1 }}>+</span>
                </summary>
                <p style={{ padding: '0 16px 22px', fontSize: 14, color: '#64748b', lineHeight: 1.8, margin: 0 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-cta" style={{
        padding: '108px 6%',
        background: 'linear-gradient(160deg, #05080f 0%, #0b1528 50%, #070a12 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Animated orbs */}
        <div style={{ position: 'absolute', top: -100, left: '22%', width: 600, height: 440, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 65%)', animation: 'orb-drift 18s ease-in-out infinite', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -80, right: '20%', width: 400, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 65%)', animation: 'orb-drift-2 22s ease-in-out infinite', pointerEvents: 'none' }}/>

        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(13,148,136,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(13,148,136,0.04) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)', WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)' }}/>

        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Live activity indicator */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32,
            padding: '6px 16px 6px 10px', borderRadius: 99,
            background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.25)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2dd4bf', animation: 'pulse-dot 2s ease-in-out infinite' }}/>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>500+ teams running on upFloat right now</span>
          </div>

          <h2 style={{
            fontSize: 'clamp(30px, 5vw, 56px)',
            fontWeight: 900, color: '#fff',
            letterSpacing: '-2.5px', marginBottom: 18, lineHeight: 1.04,
          }}>
            Stop chasing your team.<br/>
            <span style={{
              background: 'linear-gradient(90deg, #2dd4bf 0%, #38bdf8 40%, #818cf8 80%, #2dd4bf 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'shimmer 5s linear infinite',
            }}>Start closing tasks.</span>
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.44)', marginBottom: 40, lineHeight: 1.78 }}>
            Join hundreds of professional teams running their work on upFloat.<br/>Free to start — no credit card needed.
          </p>
          <div className="cta-buttons" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-cta btn-cta-orange"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#fff', padding: '16px 38px', borderRadius: 12,
                fontSize: 16, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 6px 32px rgba(249,115,22,0.52)', display: 'inline-block',
                letterSpacing: '-0.2px',
              }}>
              Start free trial
            </Link>
            <Link href="/professionals"
              style={{
                background: 'rgba(124,58,237,0.14)', color: '#c4b5fd',
                padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                textDecoration: 'none', border: '1px solid rgba(124,58,237,0.28)', display: 'inline-block',
                transition: 'background 0.18s',
              }}>
              🏛️ CPA / CA professionals →
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 22, letterSpacing: '0.02em' }}>
            14-day free trial&nbsp;&nbsp;·&nbsp;&nbsp;No credit card&nbsp;&nbsp;·&nbsp;&nbsp;Cancel anytime&nbsp;&nbsp;·&nbsp;&nbsp;Billed in {currName}
          </p>
        </div>
      </section>

      {/* ━━━ MSME TRACKER CALLOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ padding: '72px 6%', background: '#f0fdf9', borderTop: '1px solid #ccfbf1' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="msme-callout-grid msme-callout-inner" style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
            borderRadius: 24, padding: '48px 52px',
            boxShadow: '0 20px 60px rgba(13,148,136,0.22)',
          }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 8px',
                background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)',
                borderRadius: 99, marginBottom: 20 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2dd4bf', display: 'inline-block' }}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2dd4bf', letterSpacing: '0.04em' }}>FREE TOOL FOR MSME VENDORS</span>
              </div>
              <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 900, color: '#fff',
                letterSpacing: '-1px', marginBottom: 14, lineHeight: 1.15 }}>
                MSME Tracker — Never miss a<br/>
                <span style={{ color: '#2dd4bf' }}>43B(h) filing deadline</span> again
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, maxWidth: 480, marginBottom: 28 }}>
                Track outstanding vendor payments, get automated reminders at 45-day milestones,
                and generate vendor reports — completely free for the first 5 vendors.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['45-day auto alerts','MSME vendor portal','43B(h) compliance','₹99 per extra vendor'].map(f => (
                  <span key={f} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    padding: '5px 12px', borderRadius: 99 }}>{f}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
              <a href="https://msme.upfloat.co" target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', padding: '15px 28px',
                  background: '#0d9488', color: '#fff', borderRadius: 12, fontSize: 15,
                  fontWeight: 800, textDecoration: 'none', letterSpacing: '-0.2px',
                  boxShadow: '0 6px 24px rgba(13,148,136,0.5)' }}>
                Open MSME Tracker →
              </a>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', margin: 0 }}>
                msme.upfloat.co
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className="lp-footer" style={{ background: '#07090f', padding: '56px 6% 30px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 44, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #0d9488, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(13,148,136,0.35)' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontWeight: 900, fontSize: 15, color: '#fff', letterSpacing: '-0.4px' }}>upFloat</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', lineHeight: 1.75, maxWidth: 240, margin: '0 0 20px' }}>
                Task management built for professional teams. Compliance-ready, flat-priced, globally available.
              </p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {['🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇪🇺'].map(f => (
                  <span key={f} style={{ fontSize: 17 }}>{f}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Product</div>
              {['Features','Solutions','Pricing','For Professionals','Changelog'].map(l => (
                <a key={l} href={l === 'For Professionals' ? '/professionals' : '#'} className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 11 }}>{l}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Company</div>
              {['About','Blog','Careers','Contact','Status'].map(l => (
                <a key={l} href="#" className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 11 }}>{l}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Legal</div>
              {[
                { l: 'Privacy policy',          h: '/privacy' },
                { l: 'Terms of service',         h: '/terms' },
                { l: 'Data processing (DPA)',    h: 'mailto:hello@upfloat.co?subject=DPA+Request' },
                { l: 'Security',                 h: '#security' },
                { l: 'Cookie policy',            h: '/privacy#cookies' },
              ].map(({ l, h }) => (
                <a key={l} href={h} className="footer-link" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 11 }}>{l}</a>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.16)' }}>© 2026 upFloat Technology. All rights reserved.</div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[['Privacy','/privacy'],['Terms','/terms'],['Security','#security'],['DPA','mailto:hello@upfloat.co?subject=DPA+Request']].map(([l,h]) => (
                <a key={l} href={h} className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
