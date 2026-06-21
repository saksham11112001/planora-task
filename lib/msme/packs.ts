export interface MsmePack {
  tier:                 string
  label:                string
  vendor_limit:         number
  price_paise:          number
  price_label:          string
  quarterly_label:      string       // price_paise/4, shown as headline; "payable annually" shown below
  original_price_label: string | null
  per_vendor:           string
}

export const FREE_VENDOR_LIMIT = 5

export const MSME_PACKS: MsmePack[] = [
  { tier: 'free',     label: 'Free',         vendor_limit: 5,   price_paise: 0,        price_label: '₹0',      quarterly_label: '₹0',       original_price_label: null,      per_vendor: 'Free' },
  { tier: 'pack_20',  label: 'Starter',      vendor_limit: 20,  price_paise: 300000,   price_label: '₹3,000',  quarterly_label: '₹750',     original_price_label: '₹5,000',  per_vendor: '₹150/vendor' },
  { tier: 'pack_50',  label: 'Standard',     vendor_limit: 50,  price_paise: 550000,   price_label: '₹5,500',  quarterly_label: '₹1,375',   original_price_label: '₹9,000',  per_vendor: '₹110/vendor' },
  { tier: 'pack_200', label: 'Professional', vendor_limit: 200, price_paise: 1600000,  price_label: '₹16,000', quarterly_label: '₹4,000',   original_price_label: '₹24,000', per_vendor: '₹80/vendor' },
  { tier: 'pack_250', label: 'Business',     vendor_limit: 250, price_paise: 1875000,  price_label: '₹18,750', quarterly_label: '₹4,688',   original_price_label: '₹30,000', per_vendor: '₹75/vendor' },
  { tier: 'pack_500', label: 'Enterprise',   vendor_limit: 500, price_paise: 3000000,  price_label: '₹30,000', quarterly_label: '₹7,500',   original_price_label: '₹50,000', per_vendor: '₹60/vendor' },
]

export function getPackByTier(tier: string): MsmePack {
  return MSME_PACKS.find(p => p.tier === tier) ?? MSME_PACKS[0]
}

export interface MsmeAddonPack {
  slots:           number
  price_paise:     number
  price_label:     string
  label:           string
}

export const MSME_ADDON_PACKS: MsmeAddonPack[] = [
  { slots: 20,  price_paise: 300000,  price_label: '₹3,000', label: '+20 vendors' },
  { slots: 50,  price_paise: 550000,  price_label: '₹5,500', label: '+50 vendors' },
  { slots: 100, price_paise: 900000,  price_label: '₹9,000', label: '+100 vendors' },
]
