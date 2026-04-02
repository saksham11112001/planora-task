'use client'
import { useEffect, useState } from 'react'

/**
 * Branded splash shown during initial hydration / compilation.
 * Fades out once the app is interactive.
 */
export function AppLoader() {
  const [visible, setVisible] = useState(true)
  const [fading,  setFading]  = useState(false)

  useEffect(() => {
    // Fade out once the page has hydrated
    const t = setTimeout(() => {
      setFading(true)
      setTimeout(() => setVisible(false), 500)
    }, 600)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.5s ease',
      pointerEvents: fading ? 'none' : 'auto',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, position: 'relative' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(13,148,136,0.4)',
          animation: 'logoPulse 1.8s ease-in-out infinite',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 24V12L16 8L24 12V24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 24V17L16 15L20 17V24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="8" r="2" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Brand name */}
      <div style={{
        fontSize: 26, fontWeight: 800, color: '#fff',
        letterSpacing: '-0.5px', marginBottom: 8,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        Planora
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>
        Project management for modern teams
      </div>

      {/* Animated progress dots */}
      <div style={{ display: 'flex', gap: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#14b8a6',
            animation: `dotBounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(13,148,136,0.4); }
          50%       { transform: scale(1.05); box-shadow: 0 0 60px rgba(13,148,136,0.6); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
