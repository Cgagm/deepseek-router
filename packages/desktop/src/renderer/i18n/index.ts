import { createContext, useContext } from 'react'
import type { Translations } from './zh'
import zh from './zh'
import en from './en'

export type Locale = 'zh' | 'en'

const dictionaries: Record<Locale, Translations> = { zh, en }

export function getDictionary(locale: Locale): Translations {
  return dictionaries[locale] || dictionaries.zh
}

/**
 * Translate a key with optional template interpolation.
 * Usage: t('welcome_title') or t('trial_days', { days: 7 })
 */
export function t(locale: Locale, key: keyof Translations, params?: Record<string, string | number>): string {
  const dict = getDictionary(locale)
  let text: string = (dict[key] as string) ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

// React context
export const LocaleContext = createContext<Locale>('zh')
export const useLocale = () => useContext(LocaleContext)

export function useT() {
  const locale = useLocale()
  return (key: keyof Translations, params?: Record<string, string | number>) => t(locale, key, params)
}

export { zh, en }
