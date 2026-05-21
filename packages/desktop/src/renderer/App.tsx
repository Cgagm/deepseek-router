import { useEffect } from 'react'
import { useChatStore } from './store/chat'
import { useThemeStore } from './store/theme'
import { useSettingsStore } from './store/settings'
import { useViewStore } from './store/view'
import { LocaleContext } from './i18n'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ChatView from './components/ChatView'
import SkillsView from './components/SkillsView'
import TemplatesView from './components/TemplatesView'
import SettingsPanel from './components/SettingsPanel'
import CommandPalette from './components/CommandPalette'

export default function App() {
  const initTheme = useThemeStore(s => s.initTheme)
  const loadSettings = useSettingsStore(s => s.loadSettings)
  const locale = useSettingsStore(s => s.locale)
  const setSessions = useChatStore(s => s.setSessions)
  const setActiveSession = useChatStore(s => s.setActiveSession)
  const showSettings = useSettingsStore(s => s.showSettings)
  const currentView = useViewStore(s => s.currentView)

  useEffect(() => {
    initTheme()
    loadSettings()

    window.api.storage.getChats().then(sessions => {
      setSessions(sessions)
      if (sessions.length > 0) {
        setActiveSession(sessions[0].id)
      }
    })
  }, [])

  const renderMainContent = () => {
    switch (currentView) {
      case 'skills':
        return <SkillsView />
      case 'templates':
        return <TemplatesView />
      case 'chat':
      default:
        return <ChatView />
    }
  }

  return (
    <LocaleContext.Provider value={locale}>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Header />
          {renderMainContent()}
        </div>
        {showSettings && <SettingsPanel />}
        <CommandPalette />
      </div>
    </LocaleContext.Provider>
  )
}
