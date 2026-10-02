/**
 * JSON-LD structured data for the public marketing pages.
 *
 * Why this exists: search engines and AI assistants (ChatGPT, Perplexity,
 * Google's AI overviews) read schema.org markup to learn what a product IS —
 * its category, price, audience, publisher — rather than inferring it from
 * prose. Without it they have to guess, and they guess badly for a product
 * whose name is also an ordinary English word.
 *
 * Everything here is derived from values that already exist in the app
 * (country pricing, the FAQ copy on the landing page) so the markup cannot
 * drift away from what the page actually says — a mismatch between visible
 * content and markup is what gets structured data penalised.
 *
 * These builders return plain objects. They are serialised by <JsonLd/>.
 */

export const SITE_URL = 'https://upfloat.co'

/** Minimal shape taken from CountryProfile — kept local so this module does
 *  not depend on the locale table's exact export surface. */
export interface SeoPricing {
  currency: string
  starter:  number
  pro:      number
  business: number
}

/* ── Organization ──────────────────────────────────────────────────────── */
// Identity. This is what an assistant cites when asked "who makes upFloat".
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    '@id':      `${SITE_URL}/#organization`,
    name:       'upFloat',
    url:        SITE_URL,
    logo:       `${SITE_URL}/favicon.svg`,
    description:
      'upFloat builds practice management software for accounting firms — ' +
      'chartered accountants, CPAs and ACCA practices.',
    sameAs: ['https://twitter.com/upfloatco'],
  }
}

/* ── WebSite ───────────────────────────────────────────────────────────── */
// Declares the canonical site name, so results read "upFloat" and not the
// page title or the bare domain.
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    '@id':      `${SITE_URL}/#website`,
    url:        SITE_URL,
    name:       'upFloat',
    publisher:  { '@id': `${SITE_URL}/#organization` },
  }
}

/* ── SoftwareApplication ───────────────────────────────────────────────── */
/**
 * The important one. Marks upFloat as a priced SaaS product with a named
 * audience.
 *
 * `pricing` comes from the same geo-resolved CountryProfile the landing page
 * renders its price table from, so the markup always states the price the
 * visitor is actually being shown. Passing nothing omits the offers entirely
 * rather than inventing a currency — stating a wrong price is worse than
 * stating none.
 */
export function softwareApplicationSchema(pricing?: SeoPricing) {
  const offers = pricing
    ? {
        offers: {
          '@type':        'AggregateOffer',
          priceCurrency:  pricing.currency,
          lowPrice:       pricing.starter,
          highPrice:      pricing.business,
          offerCount:     3,
          // Per seat per month. Without this an assistant will quote the
          // number as if it were the whole firm's bill.
          unitText:       'per user per month',
        },
      }
    : {}

  return {
    '@context':           'https://schema.org',
    '@type':              'SoftwareApplication',
    '@id':                `${SITE_URL}/#software`,
    name:                 'upFloat',
    applicationCategory:  'BusinessApplication',
    applicationSubCategory: 'Practice Management Software',
    operatingSystem:      'Web browser',
    url:                  SITE_URL,
    publisher:            { '@id': `${SITE_URL}/#organization` },
    description:
      'All-in-one practice management for accounting firms: statutory ' +
      'compliance calendars, recurring work automation, task approvals, ' +
      'team workload, time tracking, invoicing and a client document portal.',
    featureList: [
      'Statutory compliance calendar',
      'Recurring task automation',
      'Task approvals and review workflow',
      'Client management and client portal',
      'Team workload and capacity tracking',
      'Time tracking and timesheets',
      'Invoicing and billing',
      'DSC expiry tracking',
      'Notice tracking',
      'Document collection from clients',
    ],
    audience: {
      '@type':         'Audience',
      audienceType:    'Chartered Accountants, CPAs and accounting practices',
      geographicArea: [
        { '@type': 'Country', name: 'India' },
        { '@type': 'Country', name: 'United States' },
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'Canada' },
        { '@type': 'Country', name: 'Australia' },
      ],
    },
    ...offers,
  }
}

/* ── FAQPage ───────────────────────────────────────────────────────────── */
/**
 * Answers to the questions a firm actually types into Google before buying.
 *
 * Google requires FAQ markup to correspond to content visible on the page.
 * These answers restate what the landing page already claims (pricing model,
 * trial, markets served, compliance catalogue) rather than adding new claims.
 */
export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name:    f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

/** Shared FAQ copy. Exported so a page can render the same text visibly. */
export const LANDING_FAQS: { q: string; a: string }[] = [
  {
    q: 'What is upFloat?',
    a: 'upFloat is practice management software for accounting firms. It brings ' +
       'statutory compliance calendars, recurring work, task assignment and approvals, ' +
       'team workload, time tracking, invoicing and client document collection into ' +
       'one place, so a firm stops running its work out of spreadsheets and WhatsApp.',
  },
  {
    q: 'Who is upFloat for?',
    a: 'Accounting and tax practices — chartered accountants in India, CPAs in the ' +
       'United States, and ACCA, CPA and CA practices in the United Kingdom, Canada, ' +
       'Australia and the EU. It suits firms from a single practitioner upward; there ' +
       'is no minimum team size.',
  },
  {
    q: 'Does upFloat handle Indian statutory compliance?',
    a: 'Yes. upFloat ships a catalogue of over 69 Indian statutory tasks covering GST, ' +
       'TDS, income tax, ROC and related filings, each with its own due-date rule, ' +
       'priority and sub-steps. Assign a catalogue task to a client once and upFloat ' +
       'creates each period’s instance automatically on schedule.',
  },
  {
    q: 'Can clients upload documents without an account?',
    a: 'Yes. Each client gets a secure magic-link portal. They open the link, see what ' +
       'is pending and upload it. There is no password to create and no app to install.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new firm starts on a trial with full access to the paid feature set, ' +
       'and no card is required to begin.',
  },
  {
    q: 'How is upFloat priced?',
    a: 'Per user per month, on a free, starter, pro or business tier, in the local ' +
       'currency of the firm’s country. The free tier is permanent for small teams.',
  },
]
