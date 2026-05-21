import { useState } from 'react'
import { useSettingsStore } from '../store/settings'
import { useThemeStore } from '../store/theme'
import { useT, type Locale } from '../i18n'
import { getDictionary } from '../i18n'

const TABS = [
  { id: 'general' as const, labelKey: 'tab_general' as const },
  { id: 'models' as const, labelKey: 'tab_models' as const },
  { id: 'license' as const, labelKey: 'tab_license' as const },
  { id: 'about' as const, labelKey: 'tab_about' as const },
]

const PROVIDERS = [
  { id: 'deepseek', nameKey: 'provider_deepseek_name' as const, descKey: 'provider_deepseek_desc' as const },
  { id: 'kimi', nameKey: 'provider_kimi_name' as const, descKey: 'provider_kimi_desc' as const },
  { id: 'qwen', nameKey: 'provider_qwen_name' as const, descKey: 'provider_qwen_desc' as const },
  { id: 'zhipu', nameKey: 'provider_zhipu_name' as const, descKey: 'provider_zhipu_desc' as const },
]

const THEME_KEYS: Record<string, 'theme_cherry' | 'theme_ocean' | 'theme_bamboo' | 'theme_midnight' | 'theme_sunlight'> = {
  'cherry-blossom': 'theme_cherry',
  'deep-ocean': 'theme_ocean',
  'bamboo': 'theme_bamboo',
  'midnight': 'theme_midnight',
  'sunlight': 'theme_sunlight',
}

export default function SettingsPanel() {
  const toggleSettings = useSettingsStore(s => s.toggleSettings)
  const activeTab = useSettingsStore(s => s.activeTab)
  const setActiveTab = useSettingsStore(s => s.setActiveTab)
  const apiKeys = useSettingsStore(s => s.apiKeys)
  const setApiKey = useSettingsStore(s => s.setApiKey)
  const locale = useSettingsStore(s => s.locale)
  const setLocale = useSettingsStore(s => s.setLocale)
  const theme = useThemeStore(s => s.theme)
  const themes = useThemeStore(s => s.themes)
  const setTheme = useThemeStore(s => s.setTheme)
  const t = useT()

  const [activationKey, setActivationKey] = useState('')
  const [activationMsg, setActivationMsg] = useState('')
  const [activationSuccess, setActivationSuccess] = useState(false)

  const themeNames = getDictionary(locale)

  const handleActivate = async () => {
    if (!activationKey.trim()) return
    const result = await window.api.license.activate(activationKey.trim())
    setActivationMsg(result.message)
    setActivationSuccess(result.success)
  }

  return (
    <div className="settings-overlay" onClick={toggleSettings}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>{t('settings_title')}</h2>
          <button className="header-btn" onClick={toggleSettings}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-secondary)', paddingBottom: 'var(--space-2)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 'var(--font-medium)' : 'var(--font-normal)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'general' && (
          <div className="settings-section">
            <div className="settings-section-title">{t('theme_appearance')}</div>
            <div className="theme-selector">
              {themes.map(tm => (
                <button
                  key={tm.id}
                  className={`theme-option ${theme === tm.id ? 'selected' : ''}`}
                  onClick={() => setTheme(tm.id)}
                >
                  <div className="theme-dot" style={{ background: tm.dotColor }} />
                  <span className="theme-name">{themeNames[THEME_KEYS[tm.id]] ?? tm.name}</span>
                </button>
              ))}
            </div>

            {/* Language selector */}
            <div className="settings-section-title" style={{ marginTop: 'var(--space-4)' }}>Language / 语言</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {([
                { id: 'zh' as Locale, label: '中文' },
                { id: 'en' as Locale, label: 'English' },
              ]).map(lang => (
                <button
                  key={lang.id}
                  onClick={() => setLocale(lang.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid',
                    borderColor: locale === lang.id ? 'var(--accent-primary)' : 'var(--border-secondary)',
                    background: locale === lang.id ? 'var(--accent-subtle)' : 'transparent',
                    color: locale === lang.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: locale === lang.id ? 'var(--font-medium)' : 'var(--font-normal)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="settings-section">
            <div className="settings-section-title">{t('api_key_config')}</div>
            {PROVIDERS.map(p => (
              <div key={p.id} style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                  {t(p.nameKey)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                  {t(p.descKey)}
                </div>
                <input
                  type="password"
                  value={apiKeys[p.id] || ''}
                  onChange={e => setApiKey(p.id, e.target.value)}
                  placeholder={t('input_api_key', { name: t(p.nameKey) })}
                  style={{
                    width: '100%', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)', border: '1.5px solid var(--input-border)',
                    background: 'var(--input-bg)', color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'license' && (
          <div className="settings-section">
            <div className="settings-section-title">{t('tab_license')}</div>
            <div style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
              {t('license_info')}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <input
                type="text"
                value={activationKey}
                onChange={e => setActivationKey(e.target.value)}
                placeholder={t('input_activation_code')}
                style={{
                  flex: 1, padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)', border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)', color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)', outline: 'none',
                }}
              />
              <button
                onClick={handleActivate}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--gradient-accent)', color: 'white',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                }}
              >
                {t('activate')}
              </button>
            </div>
            {activationMsg && (
              <div style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: activationSuccess ? 'var(--accent-subtle)' : 'rgba(220,38,38,0.08)',
                color: activationSuccess ? 'var(--accent-primary)' : 'var(--color-error)',
                fontSize: 'var(--text-sm)',
              }}>
                {activationMsg}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="settings-section">
            <div className="settings-section-title">{t('about_title')}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p><strong>{t('about_version')}</strong>2.0.0</p>
              <p><strong>{t('about_tech')}</strong>{t('about_tech_value')}</p>
              <p><strong>{t('about_engine')}</strong>@deepseek-router/core v1.0.11</p>
              <p><strong>{t('about_models')}</strong>{t('about_models_value')}</p>
              <p><strong>{t('about_skills')}</strong>{t('about_skills_value')}</p>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-tertiary)' }}>
                {t('about_privacy')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
