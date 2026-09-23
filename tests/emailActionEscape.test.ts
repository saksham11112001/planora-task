import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The email-action confirmation page renders the task title into HTML. Task
 * titles are typed by users, so the escaping is the only thing standing between
 * a title and script execution on a page that carries an action token in its
 * form. This is a copy of `esc` from app/api/tasks/email-action/route.ts —
 * if that one changes, this must too.
 */
function esc(s: string) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

test('escapes the characters that break out of HTML text', () => {
  assert.equal(esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;')
})

test('escapes quotes, so a title cannot break out of an attribute value', () => {
  // The token is rendered as value="...". A title containing a double quote
  // must not be able to close that attribute and add its own.
  assert.equal(esc('" onload="alert(1)'), '&quot; onload=&quot;alert(1)')
  assert.equal(esc("' onload='x"), '&#39; onload=&#39;x')
})

test('escapes ampersands first, so escaping is not double-applied', () => {
  // If & were escaped after the others, '<' would become '&amp;lt;' and render
  // as the literal text "&lt;" instead of "<".
  assert.equal(esc('&lt;'), '&amp;lt;')
  assert.equal(esc('Tax & Audit <2026>'), 'Tax &amp; Audit &lt;2026&gt;')
})

test('leaves ordinary task titles untouched', () => {
  for (const title of [
    'Trust Audit & ITR',          // the ampersand is escaped, nothing else
    'ITR FY 25-26 (copy)',
    'Shivanshu | GST Registration',
    'LLP FORMATION- ANANYA -DESIGN LAB',
  ]) {
    const out = esc(title)
    assert.ok(!out.includes('<'), `no raw < in ${out}`)
    assert.ok(!out.includes('"'), `no raw " in ${out}`)
  }
  assert.equal(esc('ITR FY 25-26 (copy)'), 'ITR FY 25-26 (copy)')
})

test('handles an empty title without throwing', () => {
  assert.equal(esc(''), '')
})
