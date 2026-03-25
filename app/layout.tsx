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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Always light mode — strip any stored dark class immediately */}
        <script dangerouslySetInnerHTML={{ __html: `
          try { document.documentElement.classList.remove('dark'); } catch(e) {}
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
