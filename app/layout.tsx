import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

export const metadata: Metadata = {
  title:       { default: 'Planora', template: '%s | Planora' },
  description: 'Project management for modern teams',
  icons: {
    icon:  [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/favicon.svg' }],
  },
  manifest: '/manifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Planora' },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning still needed for ThemeProvider useEffect
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#ffffff' }}>
      <head>
        {/* Apply saved theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            // Landing page (/) and login always stay light — never apply dark mode there
            const isPublicPage = window.location.pathname === '/' ||
                                 window.location.pathname.startsWith('/login') ||
                                 window.location.pathname.startsWith('/privacy') ||
                                 window.location.pathname.startsWith('/terms');
            if (!isPublicPage) {
              const t = localStorage.getItem('planora-theme') || 'system';
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const dark = t === 'dark' || (t === 'system' && prefersDark);
              if (dark) {
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = '#0f172a';
              } else {
                document.documentElement.style.backgroundColor = '#ffffff';
              }
            } else {
              // Force remove dark class on public pages
              document.documentElement.classList.remove('dark');
              document.documentElement.style.backgroundColor = '#ffffff';
            }
          } catch(e) {
            document.documentElement.style.backgroundColor = '#ffffff';
          }
        `}}/>
      </head>
      <body style={{ fontSize: '15px' }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
