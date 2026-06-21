# upFloat — Partner & MSME Portal: Complete Flow Reference

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

  Bronze  (1–4 active referred orgs)  →  10%
  Silver  (5–9 active referred orgs)  →  15%
  Gold    (10+ active referred orgs)  →  20%
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

## 4. Standalone Partner — Earns Per Invite Signup

### Earning Structure

| Action | Earning |
|---|---|
| Someone signs up for MSME Tracker via partner's invite | ₹500 per signup |
| Someone joins the Partner Program via partner's invite | ₹1,000 per signup |

### Partner Tiers (by total signups)

| Tier | Signups Required |
|---|---|
| Starter | 0 |
| Bronze | 1+ |
| Silver | 5+ |
| Gold | 10+ |

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

| Pack | Vendor Slots | Price (ex-GST) | Per Vendor |
|---|---|---|---|
| Free | 5 | ₹0 | — |
| Starter | 20 | ₹3,000 | ₹150 |
| Standard | 50 | ₹5,500 | ₹110 |
| Professional | 200 | ₹16,000 | ₹80 |
| Business | 250 | ₹18,750 | ₹75 |
| Enterprise | 500 | Contact sales | ₹60 |

> All paid packs charged at price + 18% GST via Razorpay.

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
  Email 1 → Day 0 (immediate)
  Email 2 → +7 days
  Email 3 → +14 days
  Email 4 → +21 days
  Email 5 → +30 days
  Max window: 30 days | Max emails: 5 | CC email configurable

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

| Rule | Value |
|---|---|
| Trial extension per referral | +7 days |
| Max total trial extension | 42 days |
| Redeemer org minimum age | 48 hours |
| One redemption per org | Yes (DB unique constraint) |
| Min payout — org partner | ₹500 |
| Min withdrawal — standalone partner | ₹500 |
| Concurrent withdrawal allowed | No (one at a time) |
| MSME email window | 30 days max |
| Max emails per vendor | 5 |
| Vendor form token validity | 30 days |
| Max vendors per import | 500 |

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
