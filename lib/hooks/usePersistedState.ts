'use client'
import { useState, useEffect } from 'react'

/**
 * useState that remembers its value in localStorage.
 *
 * For view preferences (List vs Board, calendar month vs timeline, sort order)
 * that previously reset to their default on every navigation.
 *
 * SSR-safe: the initial render always uses `initial`, so the server HTML and
 * the first client render match. The stored value is applied in an effect
 * immediately after mount, which means a stored non-default value produces one
 * extra render — deliberate, because reading localStorage during render causes
 * a hydration mismatch.
 *
 * Writes are gated on `hydrated` so the mount-time write cannot clobber the
 * stored value with the default before the read has been applied.
 *
 * `isValid` rejects stale or corrupt values (e.g. an option that no longer
 * exists), falling back to `initial` rather than putting the UI into a state
 * it can no longer render.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  isValid?: (v: unknown) => boolean,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)

  // Read once on mount (and if the key changes — e.g. a different user).
  useEffect(() => {
    setHydrated(false)
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as unknown
        if (!isValid || isValid(parsed)) setValue(parsed as T)
      }
    } catch { /* unavailable, private mode, or corrupt JSON — keep the default */ }
    setHydrated(true)
    // isValid is intentionally not a dependency: callers pass an inline
    // function, which would re-run this on every render and re-read storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!hydrated) return
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or private mode */ }
  }, [key, value, hydrated])

  return [value, setValue]
}

/** Namespaced, per-user storage key so preferences don't leak between
 *  accounts on a shared machine. */
export function viewPrefKey(name: string, userId?: string | null): string {
  return `upfloat_view_${name}_${userId ?? 'anon'}`
}
