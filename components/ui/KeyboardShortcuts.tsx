'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function KeyboardShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      // G then I = go to inbox
      // G then P = go to projects  
      // G then T = go to tasks
      // G then R = go to recurring
      // / = focus search (if exists on page)
      // Escape = close modals (handled by individual components)

      if (e.key === '/') {
        e.preventDefault()
        // Focus any search input on the page
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        searchInput?.focus()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [router, pathname])

  return null
}
