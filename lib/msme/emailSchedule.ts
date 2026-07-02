// MSME follow-up email cadence. Kept in lib/ (not the route file) so it can be
// imported without pulling in a route module — Next.js route files may only
// export request handlers + a few reserved config keys.
//
// 5 emails total: day 0 (immediate) then gaps of 7, 14, 21, 30 days.
export const DEFAULT_EMAIL_SCHEDULE = [7, 14, 21, 30]
