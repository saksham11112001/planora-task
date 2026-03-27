import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

export const metadata: Metadata = {
  title: {
    default: 'Planora — CA Task Management Software | SNG Advisers',
    template: '%s | Planora',
  },
  description: 'Planora is a task and compliance management platform built for CA firms. Manage GST, TDS, ITR deadlines, team approvals, client tasks, and recurring workflows — all in one place.',
  keywords: ['CA software India', 'CA compliance management', 'GST task management', 'TDS tracking', 'CA firm software', 'Planora', 'SNG Advisers'],
  authors: [{ name: 'SNG Advisers', url: 'https://sng-adwisers.com' }],
  creator: 'SNG Advisers',
  metadataBase: new URL('https://sng-adwisers.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://sng-adwisers.com',
    siteName: 'Planora',
    title: 'Planora — CA Task Management Software',
    description: 'Built for CA firms. Manage compliance deadlines, team tasks, client workflows, and approvals — all in one secure platform.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Planora — Work. Simplified.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planora — CA Task Management Software',
    description: 'Built for CA firms. GST, TDS, ITR deadlines. Team approvals. Client workflows.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning still needed for ThemeProvider useEffect
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#ffffff' }}>
      <head>
        {/* Apply saved theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('planora-theme') || 'system';
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const dark = t === 'dark' || (t === 'system' && prefersDark);
            if (dark) {
              document.documentElement.classList.add('dark');
              document.documentElement.style.backgroundColor = '#0f172a';
            } else {
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
