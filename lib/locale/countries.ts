/**
 * Country / region profiles for internationalisation.
 *
 * India (IN) is the launch market (ICAI / CA firms) and the default for all
 * existing orgs. Other profiles cover the planned international rollout to
 * CA/CPA firms. Each profile drives:
 *   - currency + Intl locale used by fmtCurrency / fmtDate
 *   - IANA timezone for "today" calculations on user-facing views
 *   - per-country plan pricing (monthly + annual effective monthly)
 *   - which compliance catalogue applies (only IN has the ICAI catalogue today)
 */

export interface PlanPrice {
  monthly: number
  annual: number   // effective per-month price when billed annually
}

export interface CountryProfile {
  code: string
  name: string
  flag: string
  currency: string          // ISO 4217
  currencySymbol: string
  locale: string            // BCP 47, used for Intl formatting
  timezone: string          // IANA, default org timezone
  fiscalYearStart: number   // 1-12 (month). India: April (4). Most others: January.
  dateHint: string          // human sample of the preferred format
  complianceCatalogue: 'icai' | 'none'  // statutory task catalogue available
  professionalBody: string  // shown in marketing/onboarding copy
  pricing: { starter: PlanPrice; pro: PlanPrice; business: PlanPrice }
}

export const DEFAULT_COUNTRY = 'IN'

export const COUNTRIES: Record<string, CountryProfile> = {
  IN: {
    code: 'IN', name: 'India', flag: '🇮🇳',
    currency: 'INR', currencySymbol: '₹', locale: 'en-IN',
    timezone: 'Asia/Kolkata', fiscalYearStart: 4, dateHint: '31 Mar 2026',
    complianceCatalogue: 'icai', professionalBody: 'ICAI (Chartered Accountants)',
    pricing: { starter: { monthly: 999, annual: 799 }, pro: { monthly: 2499, annual: 1999 }, business: { monthly: 4999, annual: 3999 } },
  },
  US: {
    code: 'US', name: 'United States', flag: '🇺🇸',
    currency: 'USD', currencySymbol: '$', locale: 'en-US',
    timezone: 'America/New_York', fiscalYearStart: 1, dateHint: 'Mar 31, 2026',
    complianceCatalogue: 'none', professionalBody: 'AICPA (CPAs)',
    pricing: { starter: { monthly: 29, annual: 23 }, pro: { monthly: 79, annual: 63 }, business: { monthly: 149, annual: 119 } },
  },
  GB: {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧',
    currency: 'GBP', currencySymbol: '£', locale: 'en-GB',
    timezone: 'Europe/London', fiscalYearStart: 4, dateHint: '31 Mar 2026',
    complianceCatalogue: 'none', professionalBody: 'ICAEW / ACCA',
    pricing: { starter: { monthly: 25, annual: 20 }, pro: { monthly: 65, annual: 52 }, business: { monthly: 125, annual: 99 } },
  },
  CA: {
    code: 'CA', name: 'Canada', flag: '🇨🇦',
    currency: 'CAD', currencySymbol: 'CA$', locale: 'en-CA',
    timezone: 'America/Toronto', fiscalYearStart: 1, dateHint: 'Mar 31, 2026',
    complianceCatalogue: 'none', professionalBody: 'CPA Canada',
    pricing: { starter: { monthly: 39, annual: 31 }, pro: { monthly: 99, annual: 79 }, business: { monthly: 199, annual: 159 } },
  },
  AU: {
    code: 'AU', name: 'Australia', flag: '🇦🇺',
    currency: 'AUD', currencySymbol: 'A$', locale: 'en-AU',
    timezone: 'Australia/Sydney', fiscalYearStart: 7, dateHint: '31 Mar 2026',
    complianceCatalogue: 'none', professionalBody: 'CA ANZ / CPA Australia',
    pricing: { starter: { monthly: 45, annual: 36 }, pro: { monthly: 115, annual: 92 }, business: { monthly: 219, annual: 175 } },
  },
  AE: {
    code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪',
    currency: 'AED', currencySymbol: 'AED', locale: 'en-AE',
    timezone: 'Asia/Dubai', fiscalYearStart: 1, dateHint: '31 Mar 2026',
    complianceCatalogue: 'none', professionalBody: 'Accountants & Auditors (UAE)',
    pricing: { starter: { monthly: 109, annual: 87 }, pro: { monthly: 289, annual: 231 }, business: { monthly: 549, annual: 439 } },
  },
  SG: {
    code: 'SG', name: 'Singapore', flag: '🇸🇬',
    currency: 'SGD', currencySymbol: 'S$', locale: 'en-SG',
    timezone: 'Asia/Singapore', fiscalYearStart: 1, dateHint: '31 Mar 2026',
    complianceCatalogue: 'none', professionalBody: 'ISCA',
    pricing: { starter: { monthly: 39, annual: 31 }, pro: { monthly: 105, annual: 84 }, business: { monthly: 199, annual: 159 } },
  },
}

export function getCountry(code: string | null | undefined): CountryProfile {
  return COUNTRIES[(code ?? '').toUpperCase()] ?? COUNTRIES[DEFAULT_COUNTRY]
}

export function isValidCountry(code: unknown): code is string {
  return typeof code === 'string' && code.toUpperCase() in COUNTRIES
}

/** "Today" (YYYY-MM-DD) in the given country's timezone — server-safe. */
export function todayInCountry(code: string | null | undefined): string {
  const tz = getCountry(code).timezone
  // en-CA reliably formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}
