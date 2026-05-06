import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  getResolvedTheme: () => 'light' | 'dark'
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme })
        const resolved = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme
        set({ resolvedTheme: resolved })
        document.documentElement.setAttribute('data-theme', resolved)
      },
      resolvedTheme: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      getResolvedTheme: () => {
        const { theme } = get()
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        return theme
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
