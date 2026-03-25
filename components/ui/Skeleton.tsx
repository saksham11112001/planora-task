import { cn } from '@/lib/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-100 animate-pulse rounded', className)}/>
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded-full"/>
          <Skeleton className="h-4 flex-1"/>
          <Skeleton className="h-4 w-20 hidden sm:block"/>
          <Skeleton className="h-4 w-16 hidden md:block"/>
        </div>
      ))}
    </div>
  )
}
