/**
 * useOptimistic — snapshot-based optimistic state with automatic rollback
 *
 * Pattern:
 *   const { state, optimistic, revert } = useOptimistic(initialData)
 *
 *   async function handleAction() {
 *     const snap = optimistic(draft => mutate(draft))  // instant UI update
 *     const res  = await fetch(...)
 *     if (!res.ok) revert(snap)                        // revert on failure
 *   }
 */
import { useState, useCallback } from 'react'

export function useOptimistic<T>(initial: T) {
  const [state, setState] = useState<T>(initial)

  // Apply a mutation instantly and return a snapshot for rollback
  const optimistic = useCallback((mutate: (prev: T) => T): T => {
    const snapshot = state
    setState(prev => mutate(prev))
    return snapshot
  }, [state])

  // Roll back to a previous snapshot
  const revert = useCallback((snapshot: T) => {
    setState(snapshot)
  }, [])

  // Hard-set state (e.g. after server confirms)
  const confirm = useCallback((next: T) => {
    setState(next)
  }, [])

  return { state, setState, optimistic, revert, confirm }
}
