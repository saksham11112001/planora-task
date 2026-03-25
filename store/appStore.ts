import { create } from 'zustand'

interface User    { id: string; name: string; email: string; avatar_url: string | null }
interface Org     { id: string; name: string; slug: string; plan_tier: string; logo_color: string }
interface Session { user: User; org: Org; role: string; workspaceId: string | null }

interface AppState {
  session: Session | null
  sidebarOpen: boolean
  searchOpen: boolean
  setSession: (s: Session) => void
  clearSession: () => void
  setSidebarOpen: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  session:     null,
  sidebarOpen: true,
  searchOpen:  false,
  setSession:  (s) => set({ session: s }),
  clearSession: () => set({ session: null }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSearchOpen:  (v) => set({ searchOpen: v }),
}))

/* Toast store */
interface Toast { id: string; type: 'success'|'error'|'info'; message: string }
interface ToastState { toasts: Toast[]; push: (t: Omit<Toast,'id'>) => void; remove: (id: string) => void }

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })), 3500)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push({ type: 'success', message }),
  error:   (message: string) => useToastStore.getState().push({ type: 'error',   message }),
  info:    (message: string) => useToastStore.getState().push({ type: 'info',     message }),
}
