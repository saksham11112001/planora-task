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
 * multi-thousand-row query on a timer is pure waste) and fires immediately on
 * return, which is when a stale screen is most likely to be looked at.
 *
 * Polling continues while a task detail panel is open: the panel keeps its own
 * local state, so a refresh repaints the list behind it without disturbing what
 * is being typed.
 *
 * COST. A refresh is not cheap: it re-runs the whole server component. One
 * Monitor refresh is four queries, two of them pulling up to 6,000 wide task
 * rows with four joins, then serialising all of it into an RSC payload and
 * shipping it to the browser. That is fine occasionally and ruinous on a tight
 * loop — at 30s an idle open tab did ~1,000 of them per working day, per user,
 * which is a real share of both the database's disk-IO budget and the host's
 * bandwidth bill, almost all of it to redraw a screen nobody was looking at.
 *
 * So the period is deliberately slack. The poll is the fallback; the
 * visibility/focus handler is what actually keeps the screen honest, because
 * the moment freshness matters is when someone LOOKS at the tab, and that path
 * still fires immediately.
 *
 * @param intervalMs poll period while the tab is visible. Default 2min.
 */
export function useAutoRefresh(intervalMs = 120_000): void {
  const router = useRouter()
  const [, startRefresh] = useTransition()

  useEffect(() => {
    // Refuse to run two refreshes closer together than this, whatever asks.
    // The focus/visibility handler is otherwise unbounded: someone working
    // between upFloat and a spreadsheet alt-tabs back every few seconds, and
    // each return fired a full refetch. Nothing can have changed in that gap
    // that the next one will not catch.
    const MIN_GAP_MS = 30_000
    let lastRefreshAt = Date.now()   // the page has just rendered fresh data

    const refresh = () => {
      if (document.hidden) return
      if (Date.now() - lastRefreshAt < MIN_GAP_MS) return
      lastRefreshAt = Date.now()
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
