import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider }       from '@/components/theme/ThemeProvider'
import { NavigationProgress }  from '@/components/ui/NavigationProgress'
import { KeyboardShortcuts }    from '@/components/ui/KeyboardShortcuts'

export const metadata: Metadata = {
  title:       { default: 'upFloat — Task & Practice Management for CA Firms', template: '%s | upFloat' },
  description: 'upFloat is the all-in-one task manager and practice management software built for Indian CA firms, CPAs, and MSMEs. Track compliance, manage teams, automate recurring tasks, and collaborate with clients — all in one place.',
  keywords: [
    'task manager for CA firms', 'CA practice management software', 'MSME tracker', 'compliance task management',
    'project management India', 'CA office management', 'chartered accountant software', 'CPA practice management',
    'upFloat', 'task management software India', 'compliance management', 'recurring task automation',
    'client portal for CA', 'team task tracker', 'GST compliance tracker', 'TDS compliance software',
    'income tax task management', 'practice management software India', 'accounting firm software',
  ],
  authors: [{ name: 'upFloat', url: 'https://upfloat.co' }],
  creator: 'upFloat',
  publisher: 'upFloat',
  metadataBase: new URL('https://upfloat.co'),
  alternates: { canonical: 'https://upfloat.co' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: 'mR4kX-0PEdTunuzBPrlsScd33f-EqwRorc1nP8_pY3Y' },
  openGraph: {
    type:        'website',
    url:         'https://upfloat.co',
    siteName:    'upFloat',
    title:       'upFloat — Task & Practice Management for CA Firms',
    description: 'All-in-one task manager and practice management software for Indian CA firms, CPAs, and MSMEs. Track compliance, manage teams, automate recurring tasks.',
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: 'upFloat — Practice Management for CA Firms' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'upFloat — Task & Practice Management for CA Firms',
    description: 'All-in-one task manager and practice management software for Indian CA firms, CPAs, and MSMEs.',
    images:      ['/og-image.svg'],
    creator:     '@upfloatco',
  },
  icons: {
    icon:  [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/favicon.svg' }],
  },
  manifest: '/manifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'upFloat' },
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
                                 window.location.pathname.startsWith('/terms') ||
                                 window.location.pathname.startsWith('/portal/') ||
                                 window.location.pathname.startsWith('/partners') ||
                                 window.location.pathname.startsWith('/msme') ||
                                 window.location.pathname.startsWith('/msme-landing');
            if (!isPublicPage) {
              const t = localStorage.getItem('upfloat-theme') || 'system';
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
        <NavigationProgress />
        <KeyboardShortcuts />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
