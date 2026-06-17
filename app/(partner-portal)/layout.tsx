// Standalone partner portal layout — no upFloat sidebar, no AppShell.
// This layout is intentionally minimal so the portal feels like its own product.
export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#0f172a',
      colorScheme: 'light',
    }}>
      {/*
        Force light mode: remove html.dark class (applied by app's ThemeProvider
        for dark mode users) so globals.css dark overrides don't affect this portal.
        Also force color-scheme to block Chrome's Auto Dark Mode for Web Contents.
      */}
      <style>{`:root { color-scheme: light !important; } * { color-scheme: light !important; }`}</style>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.remove('dark');` }} />
      {children}
    </div>
  )
}
