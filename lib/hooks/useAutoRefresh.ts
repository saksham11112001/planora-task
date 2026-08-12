'use client'
import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keep a server-rendered page current without the user reloading it.
 *
 * Server-fetched views (Monitor, Calendar) render from an async server
 * component, so a task a colleague completes, reassigns or adds does not appear
 * until the RSC payload is refetched. The only way to force that used to be a
 * browser reload — which throws away every filter, the selected month and the
 * scroll position, so people stopped reloading and worked from stale data.
 *
 * router.refresh() re-runs the server component and streams a new payload into
 * the SAME client component instances: React reconciles rather than remounts,
 * so filter state, dropdowns and scroll survive. It runs inside a transition so
 * the page never flashes a loading state.
 *
 * The parent view must mirror its data prop into state with an effect keyed on
 * that prop, otherwise the fresh payload arrives and is ignored.
 *
 * Polling is suspended while the tab is hidden (a background tab burning a
 * multi-thousand-row query every 30s is pure waste) and fires immediately on
 * return, which is when a stale screen is most likely to be looked at.
 *
 * Polling continues while a task detail panel is open: the panel keeps its own
 * local state, so a refresh repaints the list behind it without disturbing what
 * is being typed.
 *
 * @param intervalMs poll period while the tab is visible. Default 30s.
 */
export function useAutoRefresh(intervalMs = 30_000): void {
  const router = useRouter()
  const [, startRefresh] = useTransition()

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return
      startRefresh(() => router.refresh())
    }

    const iv    = setInterval(refresh, intervalMs)
    const onVis = () => { if (!document.hidden) refresh() }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)

    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
    // router / startRefresh are stable for the life of the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs])
}
