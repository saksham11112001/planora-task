// Standalone partner portal layout — no Planora sidebar, no AppShell.
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
      {children}
    </div>
  )
}
