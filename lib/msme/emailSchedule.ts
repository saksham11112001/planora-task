// MSME follow-up email cadence. Kept in lib/ (not the route file) so it can be
// imported without pulling in a route module — Next.js route files may only
// export request handlers + a few reserved config keys.
//
// Values are DAY OFFSETS from the first email, not gaps between emails:
// 5 emails total, sent on day 0 (immediate), 7, 14, 21 and 30 — the cadence
// every user-facing surface promises (settings modal, docs, and the "reply
// within 15 days" line inside the vendor email itself).
export const DEFAULT_EMAIL_SCHEDULE = [7, 14, 21, 30]
