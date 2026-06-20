---
title: upFloat — Partner & MSME Portal
pdf_options:
  format: A4
  margin: 28mm 20mm
  printBackground: true
  displayHeaderFooter: true
  headerTemplate: "<div style='font-size:9px;color:#94a3b8;width:100%;text-align:right;padding-right:20mm;font-family:sans-serif;'>upFloat Confidential</div>"
  footerTemplate: "<div style='font-size:9px;color:#94a3b8;width:100%;text-align:center;font-family:sans-serif;'>Page <span class='pageNumber'></span> of <span class='totalPages'></span></div>"
stylesheet: sachit-brief.css
---

# upFloat — Partner & MSME Portal

*Flow Reference for Sachit · June 2026*

---

## 1 · The Two Partner Types

| | Org-Based Partner | Standalone Partner |
|---|---|---|
| **Who** | Any CA/CPA firm on Planora | Independent individual (no Planora account needed) |
| **Earns by** | Referring other firms to upFloat | Inviting users to MSME Tracker or Partner Program |
| **Reward type** | % commission on referred firm's plan value | Fixed cash per signup |
| **Payout via** | Bank transfer (min ₹500) | Bank transfer (min ₹500) |

---

## 2 · Org-Based Partner — Referral Flow

Each firm gets an **8-character referral code**. They share:
- `upfloat.co/login?ref={code}` — for new firm signups
- `msme.upfloat.co?ref={code}` — for MSME tracker signups

**When a referral is accepted**, the referrer gets **+7 trial days** (capped at 42 days total).

### Anti-Abuse Guards (all 9 must pass)

1. Redeemer org ≥ 48 hours old
2. Redeemer hasn't redeemed before
3. Referrer is still on trial (not a paid customer)
4. No shared user accounts between the two orgs
5. No shared phone numbers between the two orgs
6. No circular referrals (A→B and B→A both blocked)
7. No network rings across orgs
8. Caller has a phone number on profile
9. Referrer hasn't hit the 42-day cap

### Commission on Plan Upgrades

| Partner Tier | Active Referred Orgs | Commission Rate |
|---|---|---|
| Bronze | 1 – 4 | 10% |
| Silver | 5 – 9 | 15% |
| Gold | 10+ | 20% |

> Commission is created when a referred firm upgrades or renews. Admin approves → partner requests payout.

**Payout lifecycle:** `pending → approved → payout requested → processing → paid`

---

## 3 · Standalone Partner — Earn Per Signup

| They Invite | Invitee Action | Partner Earns |
|---|---|---|
| MSME Tracker user | Signs up | ₹500 |
| Another partner | Joins Partner Program | ₹1,000 |

**Tier by total signups:**

| Tier | Signups |
|---|---|
| Starter | 0 |
| Bronze | 1+ |
| Silver | 5+ |
| Gold | 10+ |

**Balance** = Total Earned − (Paid + Pending Withdrawals)

Withdrawal requires bank details (Account No. + IFSC + Name). Only one withdrawal at a time.

---

## 4 · MSME Tracker — Pack Tiers & Pricing

| Pack | Vendor Slots | Price (ex-GST) | Per Vendor |
|---|---|---|---|
| Free | 5 | ₹0 | — |
| Starter | 20 | ₹3,000 | ₹150 |
| Standard | 50 | ₹5,500 | ₹110 |
| Professional | 200 | ₹16,000 | ₹80 |
| Business | 250 | ₹18,750 | ₹75 |
| Enterprise | 500 | Contact sales | ₹60 |

> All paid packs billed at price + 18% GST via Razorpay.

---

## 5 · MSME Vendor Lifecycle

```
Firm adds vendor  →  Status: Pending
        │
Email sent  →  Slot permanently consumed  →  Status: Emailed
        │
Automated follow-ups (max 5 emails over 30 days):
  Day 0  ·  Day 7  ·  Day 14  ·  Day 21  ·  Day 30
        │
Vendor opens form link (valid 30 days)
        │
        ├── Is MSME? YES
        │     Step 1 · Category (micro / small / medium)
        │             + Nature (manufacturer / trader / service)
        │     Step 2 · Udyam No. + Certificate upload
        │             + Outstanding amount
        │             (if amount > 0  →  payment proof required)
        │     → Status: Submitted
        │
        └── Is MSME? NO
              Declaration (declarant name only)
              → Status: Not MSME
```

### Critical Slot Rule

- Slot is **permanently consumed** on first email sent — even if vendor is later deleted.
- Re-adding the same email reuses the existing slot (no extra charge).
- Locked vendors (limit hit, not yet emailed) appear blurred with an upgrade prompt.

---

## 6 · GST Collection & Tax Invoice (All Payments)

Triggered before **any** payment — upFloat plan upgrade or MSME pack purchase.

1. **GST modal** shown to buyer: Legal Name *(required)*, GSTIN *(optional)*, Address / City / State / Pincode
2. Details saved against the org
3. Razorpay checkout opened — amount inclusive of 18% IGST
4. Signature verified server-side via HMAC-SHA256
5. **Tax invoice emailed** to buyer:
   - Invoice No: `INV-YYYYMMDD-XXXXXX`
   - SAC Code: `998314`
   - Shows base amount + IGST 18% breakdown
   - Seller details pulled from environment config

---

## 7 · Key Limits

| Rule | Value |
|---|---|
| Trial extension per referral | +7 days |
| Max cumulative trial extension | 42 days |
| Redeemer org minimum age | 48 hours |
| Min payout / withdrawal | ₹500 |
| Concurrent withdrawals | 1 at a time |
| MSME email window | 30 days |
| Max emails per vendor | 5 |
| Vendor form token validity | 30 days |
| Max vendors per CSV import | 500 |

---

## 8 · Who Can Do What

| Action | Owner | Admin | Manager | Member |
|---|---|---|---|---|
| Access Partner Portal | ✓ | ✓ | | |
| Buy / upgrade MSME pack | ✓ | ✓ | | |
| Modify email schedule | ✓ | ✓ | | |
| Add vendors / bulk import | ✓ | ✓ | ✓ | |
| Send emails to vendors | ✓ | ✓ | ✓ | |
| View vendors | ✓ | ✓ | ✓ | ✓ |
