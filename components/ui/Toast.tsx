'use client'
import { useToastStore } from '@/store/appStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium min-w-64 max-w-sm',
            t.type === 'success' && 'bg-green-50 border-green-200 text-green-800',
            t.type === 'error'   && 'bg-red-50   border-red-200   text-red-800',
            t.type === 'info'    && 'bg-blue-50  border-blue-200  text-blue-800',
          )}>
          {t.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0"/>}
          {t.type === 'error'   && <XCircle     className="h-4 w-4 text-red-600 flex-shrink-0"/>}
          {t.type === 'info'    && <Info        className="h-4 w-4 text-blue-600 flex-shrink-0"/>}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>
      ))}
    </div>
  )
}
