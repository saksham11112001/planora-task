/**
 * What a delivery failure actually MEANS.
 *
 * WHY THIS EXISTS
 * ---------------
 * msme_vendors.email_bounced is one boolean carrying three unrelated facts,
 * and the MSME screen reported all of them as "invalid email addresses — these
 * vendors never received your email. Fix these and re-shoot." For most of them
 * that sentence was false in every clause:
 *
 *   "Opted out — unsubscribed via email link"
 *       They DID receive it. They read it and clicked unsubscribe. Nothing is
 *       wrong with the address, and re-shooting to someone who opted out is
 *       the one thing we must never do.
 *
 *   "452-4.2.2 The recipient's inbox is out of storage space"
 *   "450 4.7.3 Organization queue quota exceeded"
 *       The address is CORRECT and the mail was deliverable — their mailbox
 *       was full at that moment. Inviting the firm to "fix" a correct address
 *       is an invitation to replace it with a wrong one.
 *
 *   "Hard bounce — address does not exist"
 *       This one, and only this one, is an invalid address to be corrected.
 *
 * Classifying the stored reason string means no migration and no new column:
 * rows that bounced months ago are reclassified correctly the moment this
 * ships, which is the whole population the firm is looking at today.
 *
 * Pure and clock-free, so the rules are testable without a database.
 */

export type BounceKind =
  /** Recipient opted out. Never contact this address again. */
  | 'unsubscribed'
  /** Recipient marked it as spam. Never contact this address again. */
  | 'spam'
  /** Address does not exist. Correct it, then it can be contacted. */
  | 'hard'
  /** Temporary: mailbox full, quota, greylisting. The address is fine. */
  | 'soft'
  /** Not recognisable. Treated as blocking, because guessing wrong here means
   *  mailing a dead address and damaging the sending domain's reputation. */
  | 'unknown'

/** The exact string app/api/msme/unsubscribe/[token] writes. */
export const UNSUBSCRIBE_REASON = 'Opted out — unsubscribed via email link'

/**
 * A leading SMTP reply code (`450`, `452-4.2.2`) or enhanced status code
 * (RFC 3463 `4.2.2`). 4 = transient, 5 = permanent. This is the most reliable
 * signal available, because the rest of the string is free prose written by
 * whichever mail server rejected the message, in whatever language.
 */
function codeClass(reason: string): '4' | '5' | null {
  const m = reason.match(/^\s*([45])\d{2}(?![\d.])/)   // reply code: 450, 550
  if (m) return m[1] as '4' | '5'
  const e = reason.match(/^\s*([45])\.\d{1,3}\.\d{1,3}\b/) // enhanced: 4.2.2
  if (e) return e[1] as '4' | '5'
  return null
}

/** Mailbox-full / rate-limit wording, for servers that send no usable code. */
const SOFT_WORDS = [
  'out of storage', 'over quota', 'overquota', 'quota exceeded', 'quota',
  'mailbox full', 'mailbox is full', 'insufficient storage',
  'temporarily', 'temporary', 'try again later', 'greylist', 'grey list',
  'soft bounce', 'timed out', 'too many messages', 'rate limit', 'throttl',
  'queue', 'busy', 'deferred', 'unavailable',
]

/** Wording that means the address itself is wrong. */
const HARD_WORDS = [
  'does not exist', 'doesn\'t exist', 'no such user', 'unknown user',
  'user unknown', 'recipient not found', 'no mailbox', 'mailbox not found',
  'address rejected', 'invalid email', 'invalid address', 'invalid recipient',
  'hard bounce', 'not a valid', 'account has been disabled', 'account disabled',
]

/**
 * Classify a stored bounce_reason.
 *
 * Order matters:
 *   1. Our own unsubscribe sentinel, which is never ambiguous.
 *   2. Spam complaints, before any code, because a complaint can arrive
 *      wrapped in a 5xx and must not be filed as a mere bad address — the
 *      remedy is different and stricter.
 *   3. The SMTP code, which is authoritative when present.
 *   4. Prose, only when there was no code.
 */
export function classifyBounce(reason: string | null | undefined): BounceKind {
  const raw = (reason ?? '').trim()
  if (!raw) return 'unknown'
  const r = raw.toLowerCase()

  if (raw === UNSUBSCRIBE_REASON) return 'unsubscribed'
  if (r.includes('unsubscrib') || r.includes('opted out') || r.includes('opt-out')) {
    return 'unsubscribed'
  }
  if (r.includes('spam') || r.includes('complaint') || r.includes('abuse report')) {
    return 'spam'
  }

  const cls = codeClass(raw)
  if (cls === '4') return 'soft'
  if (cls === '5') {
    // A 5xx is permanent, but some providers answer a full mailbox with
    // 552 ("storage exceeded"). Storage is a condition of the box, not of the
    // address, so it stays retryable.
    if (r.includes('storage') || r.includes('quota')) return 'soft'
    return 'hard'
  }

  if (HARD_WORDS.some(w => r.includes(w))) return 'hard'
  if (SOFT_WORDS.some(w => r.includes(w))) return 'soft'
  return 'unknown'
}

/**
 * Whether this failure must stop further email.
 *
 * Only a soft bounce does not. Everything else, including an unrecognised
 * reason, blocks: a send to a dead address costs sender reputation for every
 * other vendor the firm is chasing, so the default has to be "don't".
 *
 * A soft bounce blocking permanently was a real defect, not a judgement call.
 * A vendor whose inbox happened to be full on the day became unreachable for
 * ever, with the UI telling the firm to "fix" an address that was already
 * correct. The per-period email cap already bounds how often a soft-bounced
 * vendor is retried.
 */
export function isBlockingBounce(
  emailBounced: boolean,
  reason: string | null | undefined,
): boolean {
  if (!emailBounced) return false
  return classifyBounce(reason) !== 'soft'
}

export interface BounceCopy {
  /** Section heading in the MSME screen. */
  title:  string
  /** What actually happened, in the firm's terms. */
  detail: string
  /** What the firm should do about it, or null when there is nothing to do. */
  action: 'fix_email' | 'none'
}

/** How each kind is presented. Kept beside the rules so the two cannot drift. */
export function bounceCopy(kind: BounceKind): BounceCopy {
  switch (kind) {
    case 'unsubscribed':
      return {
        title:  'Opted out — do not contact again',
        detail: 'They received your email and chose to unsubscribe. Reach out by phone instead.',
        action: 'none',
      }
    case 'spam':
      return {
        title:  'Marked as spam — do not contact again',
        detail: 'Further email to this address puts your other vendor emails at risk of being filtered.',
        action: 'none',
      }
    case 'soft':
      return {
        title:  'Mailbox full or temporarily unavailable',
        detail: 'The address is correct — their inbox could not accept mail at that moment. These are retried automatically on the next send.',
        action: 'none',
      }
    case 'hard':
      return {
        title:  'Address does not exist — correct it and re-send',
        detail: 'The email was rejected because there is no such mailbox. Correcting the address clears the block.',
        action: 'fix_email',
      }
    case 'unknown':
      return {
        title:  'Delivery failed — reason not reported',
        detail: 'The mail server gave no usable reason. Check the address is right; correcting it clears the block.',
        action: 'fix_email',
      }
  }
}
