import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider }       from '@/components/theme/ThemeProvider'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
import { Suspense }              from 'react'
import { NavigationProgress }   from '@/components/ui/NavigationProgress'
import { KeyboardShortcuts }     from '@/components/ui/KeyboardShortcuts'
import { PostHogPageTracker }    from '@/components/analytics/PostHogProvider'
import { CookieConsentBanner }   from '@/components/analytics/CookieConsentBanner'
import { SentryInit }            from '@/components/analytics/SentryInit'

export const metadata: Metadata = {
  title:       { default: 'upFloat — Task & Practice Management for CA Firms', template: '%s | upFloat' },
  // Positioning is deliberately market-plural: the compliance engine already
  // ships statutory catalogues for India, the US, the UK, Canada, Australia
  // and the EU, and the app picks currency, timezone and fiscal year from the
  // org's country. Describing it as Indian-only under-sold what is already
  // built. India stays named first — it is the launch market and where the
  // existing search ranking sits — but no longer as the only one.
  description: 'upFloat is all-in-one practice management for accounting firms — CAs in India, CPAs in the US, and ACCA/CPA practices across the UK, Canada, Australia and the EU. Statutory compliance calendars, recurring work, approvals, team workload and client document collection in one place.',
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
    title:       'upFloat — Practice Management for CA & CPA Firms',
    description: 'All-in-one practice management for accounting firms — CAs, CPAs and ACCA practices across India, the US, the UK, Canada, Australia and the EU. Compliance calendars, recurring work, approvals and client portals.',
    // og:image / twitter:image are supplied by app/opengraph-image.tsx, which
    // renders a real PNG. They used to point at /og-image.svg — no major social
    // platform renders SVG share cards, so every shared link previewed blank.
  },
  twitter: {
    card:        'summary_large_image',
    title:       'upFloat — Practice Management for CA & CPA Firms',
    description: 'All-in-one practice management for accounting firms — CAs, CPAs and ACCA practices across India, the US, the UK, Canada, Australia and the EU.',
    creator:     '@upfloatco',
  },
  icons: {
    icon:  [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: '32x32' }],
    // iOS ignores SVG for the home-screen icon, so point Apple at the .ico
    // rather than a file it will silently skip.
    apple: [{ url: '/favicon.ico' }],
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
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#ffffff' }} className={inter.variable}>
      <head>
        {/* Warm up the Supabase connection early — the browser client calls it
            directly (auth/session refresh). On slow networks the DNS + TLS
            handshake alone can cost seconds; preconnect does it in parallel
            with page load instead of blocking the first auth call. */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
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
        <SentryInit />
        <NavigationProgress />
        <KeyboardShortcuts />
        <Suspense fallback={null}><PostHogPageTracker /></Suspense>
        <CookieConsentBanner />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
