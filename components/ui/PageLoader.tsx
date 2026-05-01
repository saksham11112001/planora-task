/**
 * Full-screen concentric-rings loader.
 *
 * Shown by every loading.tsx in the app while a page's data fetches in
 * the background. The 250 ms animation-delay means the spinner is
 * invisible on fast navigations (< 250 ms) and fades in gracefully on
 * slower ones — no double-wait, no flash.
 */

const CSS = `
  @keyframes pldr-spin    { to { transform: rotate(360deg) } }
  @keyframes pldr-fadein  { from { opacity: 0 } to { opacity: 1 } }
`

export function PageLoader() {
  return (
    <>
      <style>{CSS}</style>
      <div
        aria-label="Loading…"
        role="status"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-subtle, var(--bg, #ffffff))',
          zIndex: 10,
          /* Invisible for the first 250 ms — only shows on genuinely slow loads */
          animation: 'pldr-fadein 0.2s ease 0.25s both',
        }}
      >
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          {/* Outer ring — clockwise */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor:   'var(--brand, #6366f1)',
            borderRightColor: 'var(--brand, #6366f1)',
            animation: 'pldr-spin 1s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />
          {/* Middle ring — counter-clockwise */}
          <div style={{
            position: 'absolute', inset: 14,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor:    'var(--brand, #6366f1)',
            borderBottomColor: 'var(--brand, #6366f1)',
            animation: 'pldr-spin 0.8s cubic-bezier(0.4,0,0.6,1) infinite reverse',
            opacity: 0.7,
          }} />
          {/* Inner ring — clockwise, fastest */}
          <div style={{
            position: 'absolute', inset: 26,
            borderRadius: '50%',
            border: '1.5px solid transparent',
            borderTopColor: 'var(--brand, #6366f1)',
            animation: 'pldr-spin 0.55s cubic-bezier(0.4,0,0.6,1) infinite',
            opacity: 0.45,
          }} />
          {/* Centre dot */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 6, height: 6,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'var(--brand, #6366f1)',
          }} />
        </div>
      </div>
    </>
  )
}
