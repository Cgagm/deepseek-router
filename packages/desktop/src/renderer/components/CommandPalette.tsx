import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSettingsStore } from '../store/settings'
import { useThemeStore } from '../store/theme'
import { useChatStore } from '../store/chat'
import { useT } from '../i18n'
import type { Translations } from '../i18n/zh'

interface CommandItem {
  id: string
  labelKey: keyof Translations
  categoryKey: keyof Translations
  icon: string
  action: () => void
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const toggleSettings = useSettingsStore(s => s.toggleSettings)
  const t = useT()

  const COMMANDS = useMemo<CommandItem[]>(() => [
    { id: 'new-chat', labelKey: 'cmd_new_chat', categoryKey: 'cmd_category_chat', icon: '💬', action: () => {} },
    { id: 'settings', labelKey: 'cmd_open_settings', categoryKey: 'cmd_category_app', icon: '⚙️', action: () => {} },
    { id: 'theme-cherry', labelKey: 'cmd_theme_cherry', categoryKey: 'cmd_category_theme', icon: '🌸', action: () => {} },
    { id: 'theme-ocean', labelKey: 'cmd_theme_ocean', categoryKey: 'cmd_category_theme', icon: '🌊', action: () => {} },
    { id: 'theme-bamboo', labelKey: 'cmd_theme_bamboo', categoryKey: 'cmd_category_theme', icon: '🎋', action: () => {} },
    { id: 'theme-midnight', labelKey: 'cmd_theme_midnight', categoryKey: 'cmd_category_theme', icon: '🌙', action: () => {} },
    { id: 'theme-sunlight', labelKey: 'cmd_theme_sunlight', categoryKey: 'cmd_category_theme', icon: '☀️', action: () => {} },
    { id: 'skill-ppt', labelKey: 'cmd_skill_ppt', categoryKey: 'cmd_category_skill', icon: '📊', action: () => {} },
    { id: 'skill-pdf', labelKey: 'cmd_skill_pdf', categoryKey: 'cmd_category_skill', icon: '📕', action: () => {} },
    { id: 'skill-word', labelKey: 'cmd_skill_word', categoryKey: 'cmd_category_skill', icon: '📝', action: () => {} },
    { id: 'skill-excel', labelKey: 'cmd_skill_excel', categoryKey: 'cmd_category_skill', icon: '📈', action: () => {} },
    { id: 'skill-video', labelKey: 'cmd_skill_video', categoryKey: 'cmd_category_skill', icon: '🎬', action: () => {} },
    { id: 'skill-image', labelKey: 'cmd_skill_image', categoryKey: 'cmd_category_skill', icon: '🖼️', action: () => {} },
    { id: 'skill-resume', labelKey: 'cmd_skill_resume', categoryKey: 'cmd_category_skill', icon: '📋', action: () => {} },
    { id: 'skill-paper', labelKey: 'cmd_skill_paper', categoryKey: 'cmd_category_skill', icon: '📖', action: () => {} },
    { id: 'skill-contract', labelKey: 'cmd_skill_contract', categoryKey: 'cmd_category_skill', icon: '📄', action: () => {} },
    { id: 'skill-search', labelKey: 'cmd_skill_search', categoryKey: 'cmd_category_skill', icon: '🔍', action: () => {} },
    { id: 'skill-email', labelKey: 'cmd_skill_email', categoryKey: 'cmd_category_skill', icon: '✉️', action: () => {} },
    { id: 'skill-convert', labelKey: 'cmd_skill_convert', categoryKey: 'cmd_category_skill', icon: '🔄', action: () => {} },
    { id: 'skill-automation', labelKey: 'cmd_skill_automation', categoryKey: 'cmd_category_skill', icon: '🖥️', action: () => {} },
  ], [])

  const filtered = useMemo(() =>
    COMMANDS.filter(c => {
      const label = t(c.labelKey)
      const category = t(c.categoryKey)
      return label.includes(query) || category.includes(query) || c.id.includes(query.toLowerCase())
    }),
    [COMMANDS, query, t]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const execute = (item: CommandItem) => {
    setOpen(false)
    if (item.id === 'settings') toggleSettings()
    if (item.id.startsWith('theme-')) {
      const theme = item.id.replace('theme-', '') as 'cherry-blossom' | 'deep-ocean' | 'bamboo' | 'midnight' | 'sunlight'
      useThemeStore.getState().setTheme(theme)
    }
    if (item.id === 'new-chat') {
      useChatStore.getState().newSession()
    }
    item.action()
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      execute(filtered[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <>
      <div cmdk-overlay="" onClick={() => setOpen(false)} />
      <div cmdk-dialog="">
        <input
          cmdk-input=""
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t('cmd_placeholder')}
          autoFocus
        />
        <div cmdk-list="">
          {filtered.length === 0 ? (
            <div cmdk-empty="">{t('cmd_no_results')}</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                cmdk-item=""
                data-selected={i === selectedIndex ? 'true' : 'false'}
                onClick={() => execute(item)}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{t(item.labelKey)}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t(item.categoryKey)}</div>
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>↵</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
