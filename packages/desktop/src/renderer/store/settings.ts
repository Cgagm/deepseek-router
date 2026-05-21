import { create } from 'zustand'
import type { Locale } from '../i18n'

interface SettingsState {
  showSettings: boolean
  activeTab: 'general' | 'models' | 'license' | 'about'
  apiKeys: Record<string, string>
  enabledModels: Record<string, boolean>
  autostart: boolean
  minimizeToTray: boolean
  locale: Locale

  toggleSettings: () => void
  setActiveTab: (tab: SettingsState['activeTab']) => void
  setApiKey: (provider: string, key: string) => void
  toggleModel: (model: string, enabled: boolean) => void
  setAutostart: (v: boolean) => void
  setMinimizeToTray: (v: boolean) => void
  setLocale: (locale: Locale) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}

const PROVIDERS = ['deepseek', 'kimi', 'qwen', 'zhipu', 'doubao', 'hunyuan']

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showSettings: false,
  activeTab: 'general',
  apiKeys: {},
  enabledModels: {},
  autostart: false,
  minimizeToTray: true,
  locale: 'zh',

  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setApiKey: (provider, key) => {
    const keys = { ...get().apiKeys, [provider]: key }
    set({ apiKeys: keys })
    get().saveSettings()
  },

  toggleModel: (model, enabled) => {
    const models = { ...get().enabledModels, [model]: enabled }
    set({ enabledModels: models })
    get().saveSettings()
  },

  setAutostart: (v) => set({ autostart: v }),
  setMinimizeToTray: (v) => set({ minimizeToTray: v }),
  setLocale: (locale) => {
    set({ locale })
    localStorage.setItem('cc-locale', locale)
    get().saveSettings()
  },

  loadSettings: async () => {
    try {
      const saved = await window.api.storage.getSetting('settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        set({
          apiKeys: parsed.apiKeys || {},
          enabledModels: parsed.enabledModels || {},
          autostart: parsed.autostart || false,
          minimizeToTray: parsed.minimizeToTray ?? true,
          locale: parsed.locale || 'zh',
        })
      }
    } catch {
      /* use defaults */
    }
    // Also restore from localStorage
    const savedLocale = localStorage.getItem('cc-locale') as Locale | null
    if (savedLocale) set({ locale: savedLocale })
  },

  saveSettings: async () => {
    const { apiKeys, enabledModels, autostart, minimizeToTray, locale } = get()
    await window.api.storage.setSetting(
      'settings',
      JSON.stringify({
        apiKeys,
        enabledModels,
        autostart,
        minimizeToTray,
        locale,
      }),
    )
  },
}))
