/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Works per serverless instance (good protection against single-IP spam).
 * For true distributed rate limiting across all Vercel instances, replace
 * the store with Upstash Redis:
 *   npm i @upstash/ratelimit @upstash/redis
 *   https://github.com/upstash/ratelimit
 *
 * Usage:
 *   const result = checkRateLimit(ip, 'api', 100, 60_000)   // 100 req / 60s
 *   if (!result.allowed) return rateLimitResponse(result)
 */

interface Window {
  count:     number
  resetAt:   number
}

// Module-level store — persists for the lifetime of the serverless instance
const store = new Map<string, Window>()

// Prune stale entries every 5 minutes to avoid unbounded growth
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 300_000) return
  lastPrune = now
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key)
  }
}

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number   // unix ms
  limit:      number
}

/**
 * @param identifier  Unique key (e.g. IP address or `userId:endpoint`)
 * @param namespace   Logical bucket name (e.g. 'api', 'upload', 'auth')
 * @param maxRequests Max requests allowed in the window
 * @param windowMs    Window duration in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  namespace:  string,
  maxRequests: number,
  windowMs:    number,
): RateLimitResult {
  maybePrune()
  const now = Date.now()
  const key = `${namespace}:${identifier}`
  let win   = store.get(key)

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++
  const allowed   = win.count <= maxRequests
  const remaining = Math.max(0, maxRequests - win.count)

  return { allowed, remaining, resetAt: win.resetAt, limit: maxRequests }
}

/** Build a 429 Response with standard rate-limit headers */
export function buildRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status:  429,
      headers: {
        'Content-Type':         'application/json',
        'X-RateLimit-Limit':    String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset':    String(Math.ceil(result.resetAt / 1000)),
        'Retry-After':          String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    }
  )
}
