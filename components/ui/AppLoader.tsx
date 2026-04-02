'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface AppLoaderProps {
  message?: string
  className?: string
}

export default function AppLoader({ message = 'Loading...', className }: AppLoaderProps) {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex flex-col items-center justify-center',
      'bg-white dark:bg-slate-900',
      className
    )}>
      {/* Animated logo mark */}
      <div className="relative mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-teal-200 dark:border-teal-900" />
        {/* Spinning arc */}
        <div
          className="w-16 h-16 rounded-full border-4 border-transparent border-t-teal-500 border-r-orange-400
                     animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-teal-500 animate-pulse" />
        </div>
      </div>

      {/* Brand name */}
      <div className="flex items-baseline gap-0.5 mb-3">
        <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 tracking-tight">Plan</span>
        <span className="text-2xl font-bold text-orange-500 tracking-tight">ora</span>
      </div>

      {/* Message */}
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium min-w-[120px] text-center">
        {message}{''.padEnd(dots, '.')}
      </p>

      {/* Progress bar */}
      <div className="mt-6 w-48 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-teal-500 to-orange-400 rounded-full animate-progress-bar" />
      </div>
    </div>
  )
}

// ─── Inline skeleton loader for page sections ─────────────────────────────

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Inline spinner for buttons/actions ──────────────────────────────────

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="30 70"
        className="opacity-30"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
