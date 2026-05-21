import { useEffect, useState } from 'react'

import { useChatStore } from '../store/chat'
import { useViewStore } from '../store/view'
import { useT } from '../i18n'
import type { Translations } from '../i18n/zh'

const CATEGORY_ICONS: Record<string, string> = {
  office: '💼',
  student: '🎓',
  business: '🏢',
  general: '🔧',
}

const CATEGORY_KEY_MAP: Record<string, keyof Translations> = {
  office: 'cat_office',
  student: 'cat_student',
  business: 'cat_business',
  general: 'cat_general',
}

const SKILL_NAME_KEYS: Record<string, keyof Translations> = {
  'PPT全套': 'skill_ppt_full',
  'PDF工具箱': 'skill_pdf_toolbox',
  'Word全套': 'skill_word_full',
  'Excel智能处理': 'skill_excel_smart',
  '视频无水印下载': 'skill_video_dl',
  '图片处理': 'skill_image_tools',
  '简历生成器': 'skill_resume_builder',
  '论文助手': 'skill_paper_assistant',
  '解题助手': 'skill_problem_solver',
  '笔记整理': 'skill_note_organizer',
  '英语学习': 'skill_english_coach',
  '合同快手': 'skill_contract_quick',
  '营销文案工厂': 'skill_marketing_factory',
  '数据看板': 'skill_data_dashboard',
  '工商财税助手': 'skill_biz_tax_helper',
  '电脑自动化': 'skill_pc_automation',
  '联网搜索增强': 'skill_search_plus',
  '设计小工具': 'skill_design_tools',
  '邮件大师': 'skill_email_master',
  '格式转换中心': 'skill_format_converter',
}

const SKILL_ICON_MAP: Record<string, string> = {
  presentation: '📊', 'file-pdf': '📕', 'file-text': '📝', table: '📈',
  video: '🎬', image: '🖼️', 'file-user': '📋', 'book-open': '📖',
  calculator: '🔢', clipboard: '📋', languages: '🌐', scale: '⚖️',
  megaphone: '📣', 'chart-bar': '📊', building: '🏛️', cpu: '🖥️',
  search: '🔍', palette: '🎨', mail: '✉️', shuffle: '🔄',
}

export default function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const t = useT()
  const newSession = useChatStore(s => s.newSession)
  const setActiveSession = useChatStore(s => s.setActiveSession)
  const addMessage = useChatStore(s => s.addMessage)
  const setView = useViewStore(s => s.setView)

  useEffect(() => {
    window.api.storage.getSkills().then(setSkills)
  }, [])

  const filtered = activeCategory
    ? skills.filter(s => s.category === activeCategory)
    : skills

  const categories = [...new Set(skills.map(s => s.category))]

  const getSkillName = (skill: Skill) => {
    const key = SKILL_NAME_KEYS[skill.name]
    return key ? t(key) : skill.name
  }

  const handleUseSkill = (skill: Skill) => {
    const sessionId = newSession()
    setActiveSession(sessionId)

    // Prepare the skill prompt: replace {input} with a placeholder
    const prompt = skill.prompt.replace('{input}', '请按照以下要求处理')

    // Add a system-style message to set context
    addMessage({
      id: `msg_${Date.now()}_ctx`,
      role: 'assistant',
      content: `🔧 **${getSkillName(skill)}** 已就绪。\n\n请描述你的具体需求，我会按照以下框架处理：\n\n> ${skill.description}`,
      timestamp: Date.now(),
    })

    setView('chat')
  }

  return (
    <div style={{ padding: 'var(--space-6)', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
        {t('skills_title')}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        {t('skills_subtitle')}
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
          {t('all_count', { count: skills.length })}
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
            {CATEGORY_ICONS[cat] || '📋'} {t(CATEGORY_KEY_MAP[cat] || 'cat_general')}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-3)',
      }}>
        {filtered.map(skill => {
          const descKey = SKILL_NAME_KEYS[skill.name]
            ? (`${SKILL_NAME_KEYS[skill.name]}_desc` as keyof Translations)
            : null
          return (
            <div
              key={skill.id}
              onClick={() => handleUseSkill(skill)}
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
                  {SKILL_ICON_MAP[skill.icon] || '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    {getSkillName(skill)}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {descKey ? t(descKey) : skill.description}
                  </div>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <span style={{
                      padding: '2px var(--space-2)',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--accent-subtle)',
                      color: 'var(--accent-primary)',
                      fontSize: 'var(--text-xs)',
                    }}>
                      {t(CATEGORY_KEY_MAP[skill.category] || 'cat_general')}
                    </span>
                    {(skill.tools ?? []).length > 0 && (
                      <span style={{
                        padding: '2px var(--space-2)',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-tertiary)',
                        fontSize: 'var(--text-xs)',
                        marginLeft: 'var(--space-1)',
                      }}>
                        {(skill.tools ?? []).length} 工具
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
          {t('no_skills_found')}
        </div>
      )}
    </div>
  )
}
