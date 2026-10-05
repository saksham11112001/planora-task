import { createClient }               from '@/lib/supabase/server'
import { redirect }                   from 'next/navigation'
import { headers }                    from 'next/headers'
import { getCountry, isValidCountry } from '@/lib/locale/countries'
import { LandingClient }              from './LandingClient'
import { JsonLd }                     from '@/components/seo/JsonLd'
import {
  organizationSchema, webSiteSchema, softwareApplicationSchema,
}                                     from '@/lib/seo/structuredData'
import type { Metadata }              from 'next'

export const metadata: Metadata = {
  title: 'upFloat — Task & Practice Management for CA Firms',
  description: 'upFloat is the all-in-one task manager and practice management software built for Indian CA firms, CPAs, and MSMEs. Track compliance, manage teams, automate recurring tasks, and collaborate with clients.',
}

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  const hdrs      = await headers()
  const ipCountry = hdrs.get('x-vercel-ip-country') ?? hdrs.get('cf-ipcountry') ?? ''
  const country   = getCountry(isValidCountry(ipCountry) ? ipCountry : null)

  return (
    <>
      {/* Structured data. Prices come from the same geo-resolved profile the
          price table below renders from, so the markup can never state a
          price the visitor is not being shown. */}
      <JsonLd data={[
        organizationSchema(),
        webSiteSchema(),
        softwareApplicationSchema({
          currency: country.currency,
          starter:  country.pricing.starter.monthly,
          pro:      country.pricing.pro.monthly,
          business: country.pricing.business?.monthly ?? country.pricing.pro.monthly,
        }),
        // FAQPage schema is deliberately NOT emitted here. Google requires the
        // marked-up questions and answers to be visible on the page, and this
        // page has no FAQ section; publishing it anyway risks a manual action.
        // The same copy is served on /llms.txt, which carries no such rule.
        // Add the schema here the moment a visible FAQ section lands.
      ]}/>
      <LandingClient
        sym={country.currencySymbol}
        prices={{
          starter:  country.pricing.starter.monthly,
          pro:      country.pricing.pro.monthly,
          business: country.pricing.business?.monthly ?? country.pricing.pro.monthly,
        }}
        currName={country.currency}
      />
    </>
  )
}
