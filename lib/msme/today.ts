/**
 * "Today" for the MSME module.
 *
 * WHY THIS IS NOT `new Date().toISOString().slice(0, 10)`
 * ------------------------------------------------------
 * That gives the date in UTC. Vercel runs in UTC and India is UTC+5:30, so
 * between midnight and 05:30 IST the UTC date is still YESTERDAY. Every date
 * decision in this module would then be a day behind for five and a half
 * hours each night:
 *
 *   currentPeriod() would open the wrong half-year for the first 5½ hours of
 *   30 September and 31 March — the two days it matters most
 *
 *   the 15-day non-response window and the section 16 interest clock would
 *   each be computed a day short
 *
 * The rest of the codebase already settled this: the CA module takes the
 * org's today from `todayInCountry`, and the comment on lib/ca/spawnDecision
 * says plainly that it "must be the ORG's today, never the server's".
 *
 * The country is not looked up. Everything this module exists for — the MSMED
 * Act, Udyam registration, Form MSME-1, section 43B(h) — is Indian, so Indian
 * time is the right notion of today, and `todayInCountry(null)` resolves to
 * the DEFAULT_COUNTRY of 'IN' without a database round trip.
 *
 * Relative import with the extension so the unit tests can load this under
 * `node --experimental-strip-types`; countries.ts has no imports of its own.
 */
import { todayInCountry } from '../locale/countries.ts'

export function msmeToday(): string {
  return todayInCountry(null)
}
