/**
 * Rate limiter with two backends:
 *
 *  1. Upstash Redis (distributed)  — used automatically when
 *     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. This is the
 *     correct choice for production on Vercel, where many serverless instances
 *     run concurrently and each has its own memory.
 *
 *  2. In-memory sliding window (fallback) — used when Upstash env vars are
 *     absent (local dev, or if you haven't provisioned Redis yet). Protects
 *     per-instance only, so the effective limit is (limit × instance count).
 *
 * The public API (`checkRateLimit`) is async in both cases so callers don't
 * need to know which backend is active.
 *
 * To enable distributed limiting:
 *   1. Create a free Upstash Redis DB at https://console.upstash.com
 *   2. Add to Vercel env:
 *        UPSTASH_REDIS_REST_URL
 *        UPSTASH_REDIS_REST_TOKEN
 *   3. Redeploy. No code change needed — it switches automatically.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number   // unix ms
  limit:      number
}

// ── Backend detection ─────────────────────────────────────────────────────────
const UPSTASH_ENABLED =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

// Lazily-constructed Redis client (only when Upstash is configured).
let _redis: Redis | null = null
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

// Cache one Ratelimit instance per (namespace, max, window) combination.
const _limiters = new Map<string, Ratelimit>()
function limiter(namespace: string, maxRequests: number, windowMs: number): Ratelimit {
  const key = `${namespace}:${maxRequests}:${windowMs}`
  let rl = _limiters.get(key)
  if (!rl) {
    rl = new Ratelimit({
      redis:     redis(),
      limiter:   Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix:    `rl:${namespace}`,   // separate keyspace per bucket
      analytics: false,
    })
    _limiters.set(key, rl)
  }
  return rl
}

// ── In-memory fallback ────────────────────────────────────────────────────────
interface Window { count: number; resetAt: number }
const store = new Map<string, Window>()
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 300_000) return
  lastPrune = now
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key)
  }
}
function checkInMemory(
  identifier: string, namespace: string, maxRequests: number, windowMs: number,
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
  return {
    allowed:   win.count <= maxRequests,
    remaining: Math.max(0, maxRequests - win.count),
    resetAt:   win.resetAt,
    limit:     maxRequests,
  }
}

/**
 * Check whether `identifier` is within the rate limit for `namespace`.
 *
 * @param identifier  Unique key (e.g. IP address or `userId:endpoint`)
 * @param namespace   Logical bucket name (e.g. 'api', 'upload', 'auth')
 * @param maxRequests Max requests allowed in the window
 * @param windowMs    Window duration in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  namespace:  string,
  maxRequests: number,
  windowMs:    number,
): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED) {
    return checkInMemory(identifier, namespace, maxRequests, windowMs)
  }
  try {
    const { success, remaining, reset } = await limiter(namespace, maxRequests, windowMs).limit(identifier)
    return { allowed: success, remaining, resetAt: reset, limit: maxRequests }
  } catch (err) {
    // Never let a Redis hiccup take down the whole app — fail OPEN to in-memory
    // so legitimate traffic is served (the in-memory limiter still applies).
    console.error('[rateLimit] Upstash error — falling back to in-memory:', (err as Error)?.message)
    return checkInMemory(identifier, namespace, maxRequests, windowMs)
  }
}

/** Build a 429 Response with standard rate-limit headers */
export function buildRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    {
      status:  429,
      headers: {
        'Content-Type':          'application/json',
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset':     String(Math.ceil(result.resetAt / 1000)),
        'Retry-After':           String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
      },
    }
  )
}
