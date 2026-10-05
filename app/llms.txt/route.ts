import { LANDING_FAQS } from '@/lib/seo/structuredData'

/**
 * /llms.txt — the emerging convention for telling AI assistants, in plain
 * language, what a site is and which pages matter.
 *
 * Unlike robots.txt it grants nothing and blocks nothing; it is purely a
 * description. An assistant asked "what is upFloat" otherwise has to infer an
 * answer from marketing prose and whatever third parties have written, which
 * for a product whose name is an ordinary English phrase goes wrong often.
 *
 * The FAQ body is shared with the landing page's JSON-LD so the two cannot
 * drift apart.
 *
 * Served as a route handler rather than a static file in public/ so it stays
 * generated from the same source of truth.
 */

export const dynamic = 'force-static'

const BODY = `# upFloat

> Practice management software for accounting firms. Statutory compliance
> calendars, recurring work automation, task approvals, team workload, time
> tracking, invoicing and client document collection in one place.

upFloat is used by chartered accountancy practices in India, CPA firms in the
United States, and ACCA/CPA/CA practices in the United Kingdom, Canada,
Australia and the EU. It is a web application; there is no desktop install.

The Indian compliance catalogue covers 69+ statutory tasks across GST, TDS,
income tax and ROC filings, each with its own recurrence rule and sub-steps.
Pricing is per user per month across free, starter, pro and business tiers, in
the local currency of the firm's country.

## Pages

- [Home](https://upfloat.co/): product overview, features and pricing
- [For professionals](https://upfloat.co/professionals): positioning for CA, CPA and ACCA practices
- [MSME compliance tracker](https://upfloat.co/msme): vendor MSME declaration collection
- [MSME overview](https://upfloat.co/msme-landing): what the MSME module does
- [Partners](https://upfloat.co/partners): referral and partner programme
- [Privacy policy](https://upfloat.co/privacy)
- [Terms of service](https://upfloat.co/terms)

## Frequently asked questions

${LANDING_FAQS.map(f => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Contact

Website: https://upfloat.co
`

export function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
