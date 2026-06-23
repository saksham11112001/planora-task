export interface MsmePack {
  tier:                 string
  label:                string
  vendor_limit:         number
  price_paise:          number   // annual price incl. 18% GST (charged by Razorpay)
  price_label:          string   // annual display price (excl. GST) shown to user
  per_vendor:           string
  recommended?:         boolean
}

export const FREE_VENDOR_LIMIT = 5

// Annual display prices match the new pricing sheet.
// Razorpay is charged: display price + 18% GST (calculated at checkout).
export const MSME_PACKS: MsmePack[] = [
  { tier: 'free',         label: 'Free',         vendor_limit: 5,   price_paise: 0,        price_label: '₹0',       per_vendor: 'Free' },
  { tier: 'pack_25',      label: 'Starter',      vendor_limit: 25,  price_paise: 353682,   price_label: '₹2,999',   per_vendor: '₹120/vendor' },
  { tier: 'pack_100',     label: 'Growth',       vendor_limit: 100, price_paise: 943882,   price_label: '₹7,999',   per_vendor: '₹80/vendor' },
  { tier: 'pack_250',     label: 'Professional', vendor_limit: 250, price_paise: 2005882,  price_label: '₹16,999',  per_vendor: '₹68/vendor', recommended: true },
  { tier: 'pack_500',     label: 'Business',     vendor_limit: 500, price_paise: 3539882,  price_label: '₹29,999',  per_vendor: '₹60/vendor' },
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
  { slots: 25,  price_paise: 353682,  price_label: '₹2,999',  label: '+25 vendors' },
  { slots: 100, price_paise: 943882,  price_label: '₹7,999',  label: '+100 vendors' },
  { slots: 250, price_paise: 2005882, price_label: '₹16,999', label: '+250 vendors' },
]
