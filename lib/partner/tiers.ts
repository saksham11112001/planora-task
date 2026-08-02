/**
 * Partner tiers — single source of truth for tier thresholds and MSME
 * commission rates. Client-safe (no server imports): used by the partner
 * dashboard UI AND by the server-side withdrawal balance calculation, so the
 * number a partner sees is exactly the number they can withdraw.
 *
 * Commission model:
 *  - MSME referrals earn a PERCENTAGE of each pack the referred user buys,
 *    set by the partner's current tier (retroactive: the current tier's rate
 *    applies to the whole balance — simplest mental model, and rewards
 *    levelling up).
 *  - Partner-program referrals earn no commission (unchanged).
 *  - Tier is determined by total signed-up referrals (MSME + partner), same
 *    thresholds the dashboard ladder has always shown: 1 / 5 / 10.
 */

export interface PartnerTier {
  key:        'starter' | 'bronze' | 'silver' | 'gold'
  label:      string
  minSignups: number
  ratePct:    number
}

export const PARTNER_TIERS: PartnerTier[] = [
  { key: 'starter', label: 'Starter', minSignups: 0,  ratePct: 5  },
  { key: 'bronze',  label: 'Bronze',  minSignups: 1,  ratePct: 5  },
  { key: 'silver',  label: 'Silver',  minSignups: 5,  ratePct: 10 },
  { key: 'gold',    label: 'Gold',    minSignups: 10, ratePct: 20 },
]

export function tierForSignups(signedUp: number): PartnerTier {
  let current = PARTNER_TIERS[0]
  for (const t of PARTNER_TIERS) if (signedUp >= t.minSignups) current = t
  return current
}

/** Commission (in paise) for one purchased pack at the given tier rate. */
export function msmeCommissionPaise(packAmountPaise: number, ratePct: number): number {
  return Math.round((packAmountPaise * ratePct) / 100)
}
