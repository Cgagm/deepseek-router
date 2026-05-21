import { useEffect, useState } from 'react'

import { useChatStore } from '../store/chat'
import { useT } from '../i18n'
import type { Translations } from '../i18n/zh'

const CATEGORY_KEY_MAP: Record<string, keyof Translations> = {
  office: 'tcat_office',
  student: 'tcat_student',
  business: 'tcat_business',
  general: 'tcat_general',
  marketing: 'tcat_marketing',
}

const TEMPLATE_NAME_KEYS: Record<string, keyof Translations> = {
  '周报模板': 'tpl_weekly_report',
  '会议纪要': 'tpl_meeting_minutes',
  '正式邮件': 'tpl_email_formal',
  'PPT大纲': 'tpl_ppt_outline',
  '翻译助手': 'tpl_translation',
  '内容总结': 'tpl_summary',
  '合同模板': 'tpl_contract_template',
  '社媒文案': 'tpl_social_post',
  '学术搜索': 'tpl_academic_search',
  '考试复习': 'tpl_exam_review',
}

const ICON_MAP: Record<string, string> = {
  calendar: '📅', users: '👥', mail: '✉️', presentation: '📊',
  languages: '🌐', 'file-text': '📄', scale: '⚖️', 'share-2': '📱',
  search: '🔍', 'book-open': '📖',
}

export default function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const newSession = useChatStore(s => s.newSession)
  const setActiveSession = useChatStore(s => s.setActiveSession)
  const t = useT()

  useEffect(() => {
    window.api.storage.getTemplates().then(setTemplates)
  }, [])

  const filtered = activeCategory
    ? templates.filter(tm => tm.category === activeCategory)
    : templates

  const categories = [...new Set(templates.map(tm => tm.category))]

  const handleUseTemplate = (template: Template) => {
    const sessionId = newSession()
    setActiveSession(sessionId)
  }

  const getTemplateName = (tmpl: Template) => {
    const key = TEMPLATE_NAME_KEYS[tmpl.name]
    return key ? t(key) : tmpl.name
  }

  const getTemplateDesc = (tmpl: Template) => {
    const nameKey = TEMPLATE_NAME_KEYS[tmpl.name]
    if (nameKey) {
      const descKey = `${nameKey}_desc` as keyof Translations
      return t(descKey)
    }
    return tmpl.description
  }

  return (
    <div style={{ padding: 'var(--space-6)', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
        {t('templates_title')}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        {t('templates_subtitle')}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-secondary)',
            background: activeCategory === null ? 'var(--accent-subtle)' : 'transparent',
            color: activeCategory === null ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            fontWeight: activeCategory === null ? 'var(--font-medium)' : 'var(--font-normal)',
            cursor: 'pointer',
          }}
        >
          {t('all_templates', { count: templates.length })}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-secondary)',
              background: activeCategory === cat ? 'var(--accent-subtle)' : 'transparent',
              color: activeCategory === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
              fontWeight: activeCategory === cat ? 'var(--font-medium)' : 'var(--font-normal)',
              cursor: 'pointer',
            }}
          >
            {t(CATEGORY_KEY_MAP[cat] || 'tcat_general')}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-3)',
      }}>
        {filtered.map(template => (
          <div
            key={template.id}
            onClick={() => handleUseTemplate(template)}
            style={{
              padding: 'var(--space-4)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-secondary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--border-accent)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-secondary)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {ICON_MAP[template.icon] || '📋'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                  {getTemplateName(template)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  {getTemplateDesc(template)}
                </div>
                <div style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {template.content.substring(0, 80)}...
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
          {t('no_templates_found')}
        </div>
      )}
    </div>
  )
}
