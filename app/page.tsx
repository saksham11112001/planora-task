import { createClient }               from '@/lib/supabase/server'
import { redirect }                   from 'next/navigation'
import { headers }                    from 'next/headers'
import { getCountry, isValidCountry } from '@/lib/locale/countries'
import { LandingClient }              from './LandingClient'
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
    <LandingClient
      sym={country.currencySymbol}
      prices={{
        starter:  country.pricing.starter.monthly,
        pro:      country.pricing.pro.monthly,
        business: country.pricing.business?.monthly ?? country.pricing.pro.monthly,
      }}
      currName={country.currency}
    />
  )
}
