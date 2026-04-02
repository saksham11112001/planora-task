'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevPath = useRef(pathname)

  useEffect(() => {
    const current = pathname + searchParams.toString()
    const prev = prevPath.current

    if (current === prev) return
    prevPath.current = current

    // Start progress
    setVisible(true)
    setProgress(10)

    const increment = () => {
      setProgress(p => {
        if (p < 60) return p + Math.random() * 15
        if (p < 85) return p + Math.random() * 5
        return p
      })
    }

    timerRef.current = setInterval(increment, 150)

    // Complete after a short delay (Next.js renders fast)
    const complete = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }, 600)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearTimeout(complete)
    }
  }, [pathname, searchParams])

  if (!visible && progress === 0) return null

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] h-0.5 transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-teal-500 to-orange-400 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
      {/* Glow effect */}
      <div
        className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-orange-400/60 to-transparent"
        style={{ right: `${100 - progress}%` }}
      />
    </div>
  )
}
