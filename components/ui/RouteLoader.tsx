'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Slim teal progress bar at the top of the screen during route transitions.
 * Zero dependencies — uses requestAnimationFrame for smooth animation.
 */
export function RouteLoader() {
  const pathname      = usePathname()
  const searchParams  = useSearchParams()
  const [progress,    setProgress]  = useState(0)
  const [visible,     setVisible]   = useState(false)
  const timerRef      = useRef<ReturnType<typeof setTimeout>>()
  const rafRef        = useRef<number>()
  const prevPath      = useRef(pathname + searchParams.toString())

  useEffect(() => {
    const current = pathname + searchParams.toString()
    if (current === prevPath.current) return
    prevPath.current = current

    // Start loader
    setVisible(true)
    setProgress(0)

    let p = 0
    const tick = () => {
      // Fast at first, then slow down as it approaches 90%
      const inc = p < 30 ? 8 : p < 60 ? 4 : p < 80 ? 2 : p < 90 ? 0.5 : 0
      p = Math.min(p + inc, 90)
      setProgress(p)
      if (p < 90) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // Complete after a short delay (page has rendered by then)
    timerRef.current = setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setProgress(100)
      setTimeout(() => setVisible(false), 300)
    }, 400)

    return () => {
      clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [pathname, searchParams])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 3, zIndex: 9999, pointerEvents: 'none',
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #0d9488, #14b8a6, #5eead4)',
        boxShadow: '0 0 10px rgba(13,148,136,0.6)',
        transition: progress === 100 ? 'width 0.2s ease, opacity 0.3s ease' : 'width 0.15s ease',
        opacity: progress === 100 ? 0 : 1,
        borderRadius: '0 2px 2px 0',
      }}/>
    </div>
  )
}
