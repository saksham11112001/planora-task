'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setKey(k => k + 1)
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [pathname])

  if (!loading) return null

  return (
    <div
      key={key}
      className="page-loading-bar"
      style={{ width: '100%' }}
    />
  )
}
