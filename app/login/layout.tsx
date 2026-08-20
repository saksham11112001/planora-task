import type { Metadata } from 'next'

/**
 * /login is a client component, so it cannot export metadata itself — this
 * layout supplies it. Without it the page inherited the root title and
 * description word for word, which put a second indexable page into search
 * results competing with the home page for the same terms.
 *
 * noindex because a sign-in form has no business in search results; it carries
 * no content a searcher wants and dilutes the marketing pages.
 */
export const metadata: Metadata = {
  title:       'Sign in',
  description: 'Sign in to your upFloat workspace.',
  robots:      { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
