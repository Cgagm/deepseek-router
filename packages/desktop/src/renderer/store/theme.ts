import { create } from 'zustand'

type Theme = 'cherry-blossom' | 'deep-ocean' | 'bamboo' | 'midnight' | 'sunlight'

interface ThemeState {
  theme: Theme
  themes: { id: Theme; name: string; color: string; dotColor: string }[]
  setTheme: (theme: Theme) => void
  initTheme: () => void
}

const THEME_LIST = [
  { id: 'cherry-blossom' as const, name: '樱花', color: '#FEFAF6', dotColor: '#E8738A' },
  { id: 'deep-ocean' as const, name: '深海', color: '#0B1A2A', dotColor: '#0096C7' },
  { id: 'bamboo' as const, name: '竹林', color: '#F8FAF5', dotColor: '#4F772D' },
  { id: 'midnight' as const, name: '暗夜', color: '#08080C', dotColor: '#8B5CF6' },
  { id: 'sunlight' as const, name: '暖阳', color: '#FFFBF5', dotColor: '#D97706' },
]

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'sunlight',
  themes: THEME_LIST,

  setTheme: (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cc-theme', theme)
    window.api.app.setTheme(theme)
  },

  initTheme: () => {
    const saved = localStorage.getItem('cc-theme') as Theme | null
    const theme = saved || 'sunlight'
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
  },
}))
