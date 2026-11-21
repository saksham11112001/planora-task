/**
 * A fetch that cannot leave a spinner running forever.
 *
 * WHY THIS EXISTS
 * ---------------
 * Production reported `TypeError: Failed to fetch` on the MSME vendor form.
 * That page is what a vendor opens from the emailed link, and its three
 * writes — two uploads and the submit — were each written as:
 *
 *     const res  = await fetch(...)
 *     const data = await res.json()
 *     setSaving(false)
 *
 * `fetch` rejects on any network-level failure: the phone changing cell, a
 * corporate proxy, an adblocker, the tab suspending mid-request. When it
 * does, the await throws, and every line after it is skipped — including the
 * one that clears the spinner and the one that shows an error. The vendor is
 * left with a button that says "Saving…" and never stops.
 *
 * That is the worst available outcome. A vendor who sees an error tries
 * again; a vendor who sees a spinner assumes it worked and closes the tab.
 * The firm then chases someone who believes they have already declared, and
 * nobody can tell which of them is wrong.
 *
 * `res.json()` throws too, on any response that is not JSON — which is what a
 * 502 from the edge or a 413 on a large upload actually returns. Same result.
 *
 * So: this never throws. It returns a result the caller must look at, and the
 * callers clear their spinners in `finally` regardless.
 */

export type FailureKind =
  /** The request never reached the server, or the answer never came back. */
  | 'network'
  /** The server answered with an error status. */
  | 'server'
  /** The server answered, but not with JSON. A 502 HTML page, typically. */
  | 'bad_response'

export type SafeResult<T> =
  | { ok: true;  data: T }
  | { ok: false; kind: FailureKind; error: string; status?: number }

/**
 * Wording aimed at the vendor, not the developer.
 *
 * A network failure is usually theirs and usually transient, so it says to
 * try again and — the important part — that nothing they typed has been lost.
 * Without that sentence people retype the form or give up.
 */
const NETWORK_MESSAGE =
  'Could not reach the server. Check your internet connection and try again — nothing you have entered has been lost.'

const BAD_RESPONSE_MESSAGE =
  'The server returned an unexpected response. Please try again in a moment — nothing you have entered has been lost.'

/**
 * Perform a request and always come back with something the caller can act on.
 *
 * @param fetchImpl injected so the behaviour can be tested without a network.
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<SafeResult<T>> {
  let res: Response
  try {
    res = await fetchImpl(url, init)
  } catch {
    // Deliberately not surfacing the thrown message. "Failed to fetch" and
    // "NetworkError when attempting to fetch resource" mean nothing to a
    // vendor filling in a declaration.
    return { ok: false, kind: 'network', error: NETWORK_MESSAGE }
  }

  // Read the body as text first. Calling .json() on a 502 HTML page throws,
  // and that throw is what skipped the spinner reset in the original code.
  let body: string
  try {
    body = await res.text()
  } catch {
    return { ok: false, kind: 'network', error: NETWORK_MESSAGE, status: res.status }
  }

  let parsed: unknown = null
  let parseFailed = false
  if (body.trim() !== '') {
    try { parsed = JSON.parse(body) } catch { parseFailed = true }
  }

  if (!res.ok) {
    // Prefer the server's own message: the API routes return { error } and
    // those messages are written for this audience.
    const serverMsg =
      parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : null
    return {
      ok: false,
      kind: parseFailed || serverMsg === null ? 'bad_response' : 'server',
      error: serverMsg ?? BAD_RESPONSE_MESSAGE,
      status: res.status,
    }
  }

  if (parseFailed) {
    return { ok: false, kind: 'bad_response', error: BAD_RESPONSE_MESSAGE, status: res.status }
  }

  // A 200 whose body carries { error } — this codebase does that in places.
  if (parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string') {
    return { ok: false, kind: 'server', error: (parsed as { error: string }).error, status: res.status }
  }

  return { ok: true, data: (parsed ?? {}) as T }
}
