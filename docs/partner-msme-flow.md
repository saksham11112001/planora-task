# upFloat — Partner & MSME Portal: Complete Flow Reference

> **Verified against the code on 2026-08-04.** Every figure below was read
> from the source files cited beside it. If you change a rate, price or limit,
> change it here too — this document is used to brief partners and buyers.
>
> | Source of truth | File |
> |---|---|
> | Standalone-partner tiers & commission | `lib/partner/tiers.ts` |
> | Commission calculation | `lib/partner/commission.ts` |
> | Org-partner tiers | `app/api/partner/route.ts` |
> | MSME pack pricing | `lib/msme/packs.ts` |
> | Referral anti-abuse limits | `app/api/referral/apply/route.ts` |
> | Withdrawal / payout minimums | `app/api/partner-portal/withdraw/route.ts`, `app/api/partner/payout/route.ts` |
> | Email cadence | `lib/msme/emailSchedule.ts` |

---

## 1. Who Is Who

| Actor | Description |
|---|---|
| **Org-based Partner** | A Planora org (CA/CPA firm) that refers other firms. Only Owner/Admin can access the Partner Portal. |
| **Standalone Partner** | An independent person — no Planora account required. Earns by inviting MSME tracker users and other partners. |
| **Vendor** | A supplier/buyer that a CA firm needs MSME declaration from. |

---

## 2. Org-Based Partner → Refers Other CA Firms

### How It Works

1. Every Planora org auto-generates an **8-character referral code** on first Partner Portal visit.
2. Referrer shares either link:
   - `upfloat.co/login?ref={code}`
   - `msme.upfloat.co?ref={code}`
3. New org signs up via the link.
4. System runs **anti-abuse checks** (all must pass):

| # | Check |
|---|---|
| 1 | Redeemer org is ≥ 48 hours old |
| 2 | Redeemer has not redeemed a referral before |
| 3 | Referrer org is still in `trialing` status (not paid) |
| 4 | No user-ID overlap between the two orgs |
| 5 | No phone-number overlap between the two orgs |
| 6 | No circular referral (A→B and B→A both blocked) |
| 7 | No network ring (phone appears across orgs that share the same referrer) |
| 8 | Caller has a phone number on their profile |
| 9 | Referrer has not already hit the 42-day extension cap |

5. If all checks pass → **Referrer gets +7 trial days** (max 42 days cumulative).

---

## 3. Org-Based Partner — Commission on Plan Upgrades

```
Referred Org upgrades or renews a paid plan
        │
        ▼
Commission Event created  →  status: pending
        │
        ▼
Commission % based on partner tier:

  Bronze  (0–4 active referred orgs)  →  10%
  Silver  (5–9 active referred orgs)  →  15%
  Gold    (10+ active referred orgs)  →  20%

  NOTE: these are the ORG-partner rates (app/api/partner/route.ts) and are
  DIFFERENT from the standalone-partner rates in section 4 (5/10/20%).
  Two separate tier tables exist in the codebase. An org partner with zero
  referrals is already labelled "Bronze".
        │
        ▼
Admin reviews and approves  →  status: approved
        │
        ▼
Partner requests payout (minimum ₹500)
  Required: Account Number, IFSC (11 chars), Account Holder Name
        │
        ▼
All approved commissions bundled into payout  →  status: paid

Payout lifecycle:  requested → processing → paid  (or rejected)
```

---

## 4. Standalone Partner — Earns a % of Referred MSME Purchases

> Source: `lib/partner/tiers.ts`, `lib/partner/commission.ts`.
> **This section was previously wrong.** It documented flat payouts of ₹500 per
> MSME signup and ₹1,000 per partner signup. The code has never paid that.

### Earning Structure

| Action | Earning |
|---|---|
| Someone signs up for MSME Tracker via the partner's invite, **and buys a pack** | **A percentage of what they pay**, set by the partner's current tier |
| Someone signs up for MSME Tracker but stays on the free plan | Nothing (until they buy) |
| Someone joins the Partner Program via the partner's invite | **No direct payment** — but the signup counts toward the tier, which raises the rate on *all* MSME referrals |

The rate is **retroactive**: reaching a new tier applies the higher rate to the
partner's whole balance, not just to referrals made afterwards.

Per invited email, at most **one** commission-bearing pack counts — the latest
paid pack of the first of their orgs that has one.

### Partner Tiers (by total signed-up referrals: MSME + partner)

| Tier | Signups Required | Commission Rate |
|---|---|---|
| Starter | 0 | 5% |
| Bronze | 1+ | 5% |
| Silver | 5+ | 10% |
| Gold | 10+ | 20% |

### Referral Chain
- Every standalone partner has a `referred_by` field storing their upline's referral code.
- Multi-level chain is tracked (not paid — informational only in current implementation).

### Balance & Withdrawal

```
Available Balance = Total Earned − (Paid + Pending Withdrawals)

Withdrawal request:
  Minimum: ₹500
  Required: Account Number, IFSC, Account Holder Name (UPI optional)
  Rule: No new withdrawal allowed while one is pending/processing

Withdrawal lifecycle:  requested → processing → paid  (or rejected)
```

---

## 5. MSME Tracker — How It Works

### Pack Tiers

> Source: `lib/msme/packs.ts`. **The previous table was wrong on every row** —
> it listed slot counts and prices that do not exist in the product.

| Pack | `tier` key | Vendor Slots | Price (ex-GST) | Per Vendor |
|---|---|---|---|---|
| Free | `free` | 5 | ₹0 | — |
| Starter | `pack_25` | 25 | ₹2,999 | ₹120 |
| Growth | `pack_100` | 100 | ₹7,999 | ₹80 |
| Professional ★ | `pack_250` | 250 | ₹16,999 | ₹68 |
| Business | `pack_500` | 500 | ₹29,999 | ₹60 |
| Enterprise | `pack_enterprise` | Custom | Contact sales | — |

★ = flagged `recommended` in the UI. Enterprise is **not purchasable online** —
the pay route rejects it and directs the buyer to support@upfloat.co.

> All paid packs are charged at **price + 18% GST** via Razorpay. Prices are
> stored ex-GST in paise; checkout multiplies by 1.18 and applies any coupon.

### Add-on Slot Packs

| Add-on | Slots | Price (ex-GST) |
|---|---|---|
| +25 vendors | 25 | ₹2,999 |
| +100 vendors | 100 | ₹7,999 |
| +250 vendors | 250 | ₹16,999 |

Add-on slots are added to the pack limit (`pack.vendor_limit + extra_slots`),
and are priced identically to the equivalent pack.

---

### Vendor Lifecycle

```
CA Firm adds vendor (Name + Email + optional GSTIN)
        │
        ▼
Status: Pending

First email sent  →  slot permanently consumed
        │
        ▼
Status: Emailed

Automated email sequence (customisable):
  Email 1 → Day 0 (immediate, on "Shoot email")
  Email 2 → Day 7
  Email 3 → Day 14
  Email 4 → Day 21
  Email 5 → Day 30
  Max window: 30 days | Max emails: 5 | CC email configurable

  Schedule values are DAY OFFSETS from the first email, not gaps between
  consecutive emails (lib/msme/emailSchedule.ts). Reply-To is set to the
  configured contact person, falling back to the CC address, so vendor
  replies reach a human. Vendors who unsubscribe or hard-bounce are excluded
  from all further automated reminders.

        │
        ▼
Vendor receives form link (valid 30 days)

  ┌─────────────────────────────────────────┐
  │  IS MSME?                               │
  │                                         │
  │  YES                        NO          │
  │   │                          │          │
  │   ▼                          ▼          │
  │ Page 1: Yes/No          Declaration    │
  │ Page 2: Category +      (Declarant     │
  │         Nature          name only)     │
  │ Page 3: Udyam No. +          │         │
  │         Certificate +         │         │
  │         Outstanding amt        │         │
  │         (proof if amt > 0)     │         │
  │   │                           │         │
  │   ▼                           ▼         │
  │ Status: Submitted       Status: Not MSME│
  └─────────────────────────────────────────┘
```

### Email Slot Rules

| Rule | Behaviour |
|---|---|
| Slot consumed | On first email sent to a vendor |
| Soft-delete vendor | Slot stays consumed — NOT freed |
| Re-add same email | Reuses existing slot — no extra charge |
| Locked vendor | Has received no email AND org has hit vendor limit |
| Unlocked vendor | Has been emailed before OR org still has free slots |

---

## 6. GST Details & Tax Invoice Flow (All Payments)

```
Payment triggered (upFloat plan upgrade OR MSME pack purchase)
        │
        ▼
GST Details Modal shown:
  • Legal / Company Name  (required)
  • GSTIN                 (optional, validated)
  • Address, City, State, Pincode (optional)
        │
        ▼
GST details saved to org_feature_settings (key: billing_gst)
        │
        ▼
Razorpay checkout opened
  Amount = base price × 1.18  (GST-inclusive)
        │
        ▼
Payment completed → HMAC-SHA256 signature verified server-side
        │
        ▼
Tax invoice emailed to buyer:
  • Invoice No:  INV-YYYYMMDD-XXXXXX
  • SAC Code:    998314
  • Breakdown:   Base amount + IGST 18%
  • Seller:      SELLER_LEGAL_NAME / SELLER_GSTIN / SELLER_ADDRESS (env vars)
  • Buyer:       GST details collected above
```

---

## 7. Key Limits Quick Reference

| Rule | Value | Source |
|---|---|---|
| Trial extension per referral | +7 days | `referral/apply` `EXTENSION_PER_REFERRAL` |
| Max total trial extension | 42 days | `referral/apply` `MAX_EXTENSION_DAYS` |
| Redeemer org minimum age | 48 hours | `referral/apply` `MIN_ORG_AGE_HOURS` |
| One redemption per org | Yes (DB unique constraint) | `referral_redemptions` |
| Min payout — org partner | ₹500 (50000 paise) | `partner/payout` `MIN_PAYOUT_PAISE` |
| Min withdrawal — standalone partner | ₹500 (50000 paise) | `partner-portal/withdraw` `MIN_WITHDRAWAL_PAISE` |
| Concurrent withdrawal allowed | No (one at a time) | `partner-portal/withdraw` |
| IFSC format enforced | `^[A-Z]{4}0[A-Z0-9]{6}$` | `partner-portal/withdraw` |
| Free vendor slots | 5 | `packs.ts` `FREE_VENDOR_LIMIT` |
| MSME email window | 30 days max | `emailSchedule.ts` |
| Max emails per vendor | 5 (1 + up to 4 reminders) | `emailSchedule.ts` |
| Vendor form token validity | 30 days | `vendors/[id]/shoot-email` |
| Max vendors per import | 500 | `msme/import` |
| GST added at checkout | 18% | `msme/pay` |
| Udyam number format | `UDYAM-XX-00-0000000` | `msme/submit/[token]` |

---

## 8. Permissions Summary

| Action | Who Can |
|---|---|
| Access Partner Portal | Owner, Admin |
| Request commission payout | Owner, Admin |
| Send partner/MSME invites | Owner, Admin |
| Buy / upgrade MSME pack | Owner, Admin |
| Add vendors, bulk import | Owner, Admin, Manager |
| Send emails to vendors | Owner, Admin, Manager |
| View vendors | Owner, Admin, Manager, Member |
| Modify email schedule / CC email | Owner, Admin |
| View MSME settings | Owner, Admin |
