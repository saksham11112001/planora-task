/**
 * Classifying delivery failures.
 *
 * Every string in the first block is REAL — copied from the firm's own bounce
 * list, which reported all ten as "invalid email addresses ... these vendors
 * never received your email. Fix these and re-shoot." Five had opted out and
 * four had a full mailbox, so that sentence was wrong about nine of them and
 * the suggested action was wrong about all nine.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyBounce, isBlockingBounce, bounceCopy, UNSUBSCRIBE_REASON,
} from '../lib/msme/bounceKind.ts'

/* ── the exact strings that were mislabelled in production ───────────────── */

describe('the real bounce list', () => {
  test('an unsubscribe is not an invalid address', () => {
    assert.equal(classifyBounce(UNSUBSCRIBE_REASON), 'unsubscribed')
    assert.equal(classifyBounce('Opted out — unsubscribed via email link'), 'unsubscribed')
  })

  test('Outlook org queue quota is temporary, not a bad address', () => {
    const reason =
      '450 4.7.3 Organization queue quota exceeded. ' +
      '[CYXPR84MB3613.NAMPRD84.PROD.OUTLOOK.COM 2026-11-13T18:33:56.448Z 08DF40E47C1324AE]'
    assert.equal(classifyBounce(reason), 'soft')
  })

  test('Gmail "inbox is out of storage space" is temporary', () => {
    const reason =
      "452-4.2.2 The recipient's inbox is out of storage space. Please direct the " +
      '452 4.2.2 recipient to 452 4.2.2 https://support.google.com/mail/?p=OverQuotaTemp'
    assert.equal(classifyBounce(reason), 'soft')
  })

  test('only a genuine dead mailbox is a hard bounce', () => {
    assert.equal(classifyBounce('Hard bounce — address does not exist'), 'hard')
    assert.equal(classifyBounce('Invalid email address'), 'hard')
    assert.equal(classifyBounce('550 5.1.1 User unknown'), 'hard')
  })

  test('a spam complaint is its own thing, not a bad address', () => {
    assert.equal(classifyBounce('Marked as spam by recipient'), 'spam')
  })
})

/* ── the SMTP code is what decides, when there is one ────────────────────── */

describe('SMTP codes', () => {
  test('4xx is transient, 5xx is permanent', () => {
    assert.equal(classifyBounce('451 Requested action aborted'), 'soft')
    assert.equal(classifyBounce('421 Service not available'),    'soft')
    assert.equal(classifyBounce('550 Requested action not taken'), 'hard')
    assert.equal(classifyBounce('553 Mailbox name not allowed'),   'hard')
  })

  test('a bare enhanced status code is read the same way', () => {
    assert.equal(classifyBounce('4.2.2 mailbox full'),  'soft')
    assert.equal(classifyBounce('5.1.1 bad destination'), 'hard')
  })

  test('a 5xx about STORAGE is still the box, not the address', () => {
    // 552 is permanent by the letter of the spec, but every provider that
    // sends it for a full mailbox accepts mail again once space is freed.
    // Telling the firm to change a correct address would be the wrong call.
    assert.equal(classifyBounce('552 5.2.2 Over quota'), 'soft')
    assert.equal(classifyBounce('552 Requested mail action aborted: exceeded storage allocation'), 'soft')
  })

  test('a number that is not a reply code does not hijack the result', () => {
    // "500 recipients" is a count, not a 5xx code.
    assert.equal(classifyBounce('Message rejected: more than 500 recipients'), 'unknown')
    assert.equal(classifyBounce('4500 is not a code'), 'unknown')
  })

  test('a spam complaint wrapped in a 5xx is still a complaint', () => {
    // The remedy differs: a bad address gets corrected, a complaint must never
    // be mailed again at all.
    assert.equal(classifyBounce('550 5.7.1 Message identified as spam'), 'spam')
  })
})

/* ── prose fallbacks, for servers that send no code ──────────────────────── */

describe('prose fallback', () => {
  test('mailbox-full wording without a code is soft', () => {
    assert.equal(classifyBounce('The mailbox is full'), 'soft')
    assert.equal(classifyBounce('Recipient server temporarily unavailable'), 'soft')
    assert.equal(classifyBounce('Greylisted, try again later'), 'soft')
  })

  test('no-such-user wording without a code is hard', () => {
    assert.equal(classifyBounce('No such user here'), 'hard')
    assert.equal(classifyBounce('Recipient not found'), 'hard')
  })

  test('nothing recognisable is unknown, never silently "fine"', () => {
    assert.equal(classifyBounce('Delivery failed'), 'unknown')
    assert.equal(classifyBounce(''), 'unknown')
    assert.equal(classifyBounce(null), 'unknown')
    assert.equal(classifyBounce(undefined), 'unknown')
  })

  test('classification ignores casing and padding', () => {
    assert.equal(classifyBounce('  HARD BOUNCE — ADDRESS DOES NOT EXIST  '), 'hard')
    assert.equal(classifyBounce('  450 4.7.3 Queue Quota Exceeded '), 'soft')
  })
})

/* ── what blocks further email ───────────────────────────────────────────── */

describe('isBlockingBounce', () => {
  test('a vendor who never bounced is never blocked', () => {
    assert.equal(isBlockingBounce(false, null), false)
    assert.equal(isBlockingBounce(false, 'Hard bounce — address does not exist'), false)
  })

  test('opt-out and spam block permanently — this must never regress', () => {
    assert.equal(isBlockingBounce(true, UNSUBSCRIBE_REASON), true)
    assert.equal(isBlockingBounce(true, 'Marked as spam by recipient'), true)
  })

  test('a hard bounce blocks until the address is corrected', () => {
    assert.equal(isBlockingBounce(true, 'Hard bounce — address does not exist'), true)
  })

  test('a full mailbox does NOT block — this is the defect being fixed', () => {
    // Before this, one full inbox made a vendor unreachable for ever.
    assert.equal(isBlockingBounce(true, '452-4.2.2 inbox is out of storage space'), false)
    assert.equal(isBlockingBounce(true, '450 4.7.3 Organization queue quota exceeded'), false)
  })

  test('an unrecognised reason blocks, because guessing wrong costs reputation', () => {
    assert.equal(isBlockingBounce(true, 'Delivery failed'), true)
    assert.equal(isBlockingBounce(true, null), true)
  })
})

/* ── the words the firm actually reads ───────────────────────────────────── */

describe('bounceCopy', () => {
  test('no kind is described as an invalid address unless it is one', () => {
    for (const k of ['unsubscribed', 'spam', 'soft'] as const) {
      const c = bounceCopy(k)
      assert.ok(!/invalid/i.test(c.title + c.detail),
        `${k} must not be called invalid: ${c.title}`)
    }
  })

  test('nothing claims the vendor never received the email except a real failure', () => {
    // The opted-out vendor demonstrably DID receive it.
    const c = bounceCopy('unsubscribed')
    assert.ok(/received/i.test(c.detail), 'should say plainly that they got it')
    assert.equal(c.action, 'none', 'offering to "fix" an opt-out invites a re-send')
  })

  test('only the kinds a new address can fix offer that action', () => {
    assert.equal(bounceCopy('hard').action,    'fix_email')
    assert.equal(bounceCopy('unknown').action, 'fix_email')
    assert.equal(bounceCopy('soft').action,         'none')
    assert.equal(bounceCopy('unsubscribed').action, 'none')
    assert.equal(bounceCopy('spam').action,         'none')
  })

  test('every kind has copy — a missing case would render an empty box', () => {
    for (const k of ['unsubscribed', 'spam', 'soft', 'hard', 'unknown'] as const) {
      const c = bounceCopy(k)
      assert.ok(c.title.length > 0 && c.detail.length > 0, `${k} has copy`)
    }
  })
})
