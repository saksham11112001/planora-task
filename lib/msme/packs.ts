export interface MsmePack {
  tier:                 string
  label:                string
  vendor_limit:         number
  price_paise:          number   // annual BASE price EXCLUDING GST. Checkout adds 18%.
                                 // Must stay ex-GST: the pay route multiplies by 1.18.
  price_label:          string   // annual display price (excl. GST) shown to user
  per_vendor:           string
  recommended?:         boolean
}

export const FREE_VENDOR_LIMIT = 5

// Annual display prices match the new pricing sheet.
// Razorpay is charged: display price + 18% GST (calculated at checkout).
export const MSME_PACKS: MsmePack[] = [
  { tier: 'free',         label: 'Free',         vendor_limit: 5,   price_paise: 0,        price_label: '₹0',       per_vendor: 'Free' },
  { tier: 'pack_25',      label: 'Starter',      vendor_limit: 25,  price_paise: 299900,   price_label: '₹2,999',   per_vendor: '₹120/vendor' },
  { tier: 'pack_100',     label: 'Growth',       vendor_limit: 100, price_paise: 799900,   price_label: '₹7,999',   per_vendor: '₹80/vendor' },
  { tier: 'pack_250',     label: 'Professional', vendor_limit: 250, price_paise: 1699900,  price_label: '₹16,999',  per_vendor: '₹68/vendor', recommended: true },
  { tier: 'pack_500',     label: 'Business',     vendor_limit: 500, price_paise: 2999900,  price_label: '₹29,999',  per_vendor: '₹60/vendor' },
  { tier: 'pack_enterprise', label: 'Enterprise', vendor_limit: 9999, price_paise: 0,      price_label: 'Custom',   per_vendor: '—' },
]

export function getPackByTier(tier: string): MsmePack {
  return MSME_PACKS.find(p => p.tier === tier) ?? MSME_PACKS[0]
}

// Addon packs map to the same pricing tiers — user adds slots from plans below their current tier
export interface MsmeAddonPack {
  slots:           number
  price_paise:     number
  price_label:     string
  label:           string
}

export const MSME_ADDON_PACKS: MsmeAddonPack[] = [
  { slots: 25,  price_paise: 299900,  price_label: '₹2,999',  label: '+25 vendors' },
  { slots: 100, price_paise: 799900,  price_label: '₹7,999',  label: '+100 vendors' },
  { slots: 250, price_paise: 1699900, price_label: '₹16,999', label: '+250 vendors' },
]

/* ─────────────────────────────────────────────────────────────────────────
   Annual term
   ─────────────────────────────────────────────────────────────────────────
   Packs are sold as a ONE-YEAR subscription. The prices above were always
   described as annual, but nothing ever expired: a single payment bought the
   vendor limit forever. These helpers are the single place that decides what
   an org is entitled to today, so the four enforcement points (vendor list,
   single email send, bulk send, settings) can never drift apart on it.
   ───────────────────────────────────────────────────────────────────────── */

/** Shape stored in org_feature_settings.config for feature_key='msme_pack'. */
export interface MsmePackConfig {
  tier?:        string
  vendor_limit?: number
  paid_at?:     string | null
  /** Written from the annual term at purchase. Absent on rows created before
   *  packs became annual — those fall back to paid_at + 1 year. */
  expires_at?:  string | null
}

/** End of a term of `months` starting at the given instant, as an ISO string.
 *  Defaults to the standard 12-month pack term; coupon grants pass the
 *  coupon's own duration_months so a 6-month promo really is six months. */
export function packExpiryFrom(paidAtIso: string, months = 12): string {
  const d = new Date(paidAtIso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export interface PackEntitlement {
  tier:        string
  /** Vendor slots the org may actually use right now, add-ons included. */
  vendorLimit: number
  expiresAt:   string | null
  isExpired:   boolean
}

/**
 * What this org is entitled to at `now`.
 *
 * An expired pack falls back to the free allowance, and takes its add-on slots
 * with it — add-ons extend a subscription rather than being bought outright,
 * so letting them outlive the pack would leave someone on the cheapest tier
 * holding hundreds of slots for ever.
 *
 * An org with add-on slots but no pack at all keeps them: there is no term for
 * them to be attached to, and taking away something bought while no
 * subscription existed would be the wrong way round.
 *
 * Legacy rows carry no expires_at, so the term is derived from paid_at. That
 * makes the rule retroactive by design — anything paid more than a year ago is
 * already past its term.
 */
export function resolvePackEntitlement(
  packConfig: MsmePackConfig | null | undefined,
  addonSlots: number = 0,
  now: Date = new Date(),
): PackEntitlement {
  const tier      = packConfig?.tier ?? 'free'
  const packLimit = packConfig?.vendor_limit ?? FREE_VENDOR_LIMIT

  // No paid pack: free allowance, plus any add-ons bought on their own.
  if (!packConfig || tier === 'free') {
    return { tier: 'free', vendorLimit: FREE_VENDOR_LIMIT + addonSlots, expiresAt: null, isExpired: false }
  }

  const expiresAt =
    packConfig.expires_at ??
    (packConfig.paid_at ? packExpiryFrom(packConfig.paid_at) : null)

  // A paid pack with no date at all cannot be judged expired — treat it as
  // live rather than silently revoking access we cannot date.
  const isExpired = !!expiresAt && new Date(expiresAt).getTime() <= now.getTime()

  if (isExpired) {
    return { tier: 'free', vendorLimit: FREE_VENDOR_LIMIT, expiresAt, isExpired: true }
  }
  return { tier, vendorLimit: packLimit + addonSlots, expiresAt, isExpired: false }
}
