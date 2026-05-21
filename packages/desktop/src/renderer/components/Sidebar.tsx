import { useEffect, useState } from 'react'
import { useChatStore } from '../store/chat'
import { useViewStore } from '../store/view'
import { useT } from '../i18n'

export default function Sidebar() {
  const sessions = useChatStore(s => s.sessions)
  const activeSessionId = useChatStore(s => s.activeSessionId)
  const setActiveSession = useChatStore(s => s.setActiveSession)
  const newSession = useChatStore(s => s.newSession)
  const currentView = useViewStore(s => s.currentView)
  const setView = useViewStore(s => s.setView)
  const t = useT()

  const [licenseStatus, setLicenseStatus] = useState<{ type: string; trialDaysLeft?: number }>({ type: 'loading' })
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)

  useEffect(() => {
    window.api.license.getStatus().then(s => {
      setLicenseStatus(s)
      if (s.type === 'token') {
        window.api.license.getBalance().then(b => setTokenBalance(b.tokens))
      }
    })
  }, [])

  const handleNewChat = () => {
    newSession()
    setView('chat')
  }

  const handleSelectSession = (id: string) => {
    setActiveSession(id)
    setView('chat')
  }

  const formatTokens = (t: number) =>
    t >= 10000 ? `${(t / 10000).toFixed(1)}万` : t.toLocaleString()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand" onClick={handleNewChat} style={{ cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>{t('app_short')}</span>
        </div>
        <button
          className="input-action-btn"
          onClick={handleNewChat}
          title={t('new_chat')}
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)', borderRadius: 'var(--radius-md)', width: 32, height: 32, fontWeight: 700, fontSize: 18, WebkitAppRegion: 'no-drag' }}
        >
          +
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
          onClick={handleNewChat}
          style={{ marginBottom: 'var(--space-3)', fontWeight: 600 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('new_chat')}
        </button>

        <div className="nav-section">
          <div className="nav-section-title">{t('chat_history')}</div>
          {sessions.length === 0 ? (
            <div style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
              {t('no_conversations')}
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  className={`nav-item ${session.id === activeSessionId && currentView === 'chat' ? 'active' : ''}`}
                  onClick={() => handleSelectSession(session.id)}
                  style={{ flex: 1 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {session.title}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('features')}</div>
          <button
            className={`nav-item ${currentView === 'skills' ? 'active' : ''}`}
            onClick={() => setView('skills')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {t('skills_center')}
          </button>
          <button
            className={`nav-item ${currentView === 'templates' ? 'active' : ''}`}
            onClick={() => setView('templates')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            {t('templates')}
          </button>
        </div>
      </nav>

      <div style={{ padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--border-secondary)' }}>
        {licenseStatus.type === 'buyout' && (
          <div className="balance-badge">{t('buyout')}</div>
        )}
        {licenseStatus.type === 'token' && tokenBalance !== null && (
          <div className="balance-badge">{formatTokens(tokenBalance)} Token</div>
        )}
        {licenseStatus.type === 'trial' && (
          <div className="balance-badge" style={{ background: 'rgba(234,88,12,0.1)', borderColor: 'rgba(234,88,12,0.3)', color: 'var(--color-warning)' }}>
            {t('trial_days', { days: licenseStatus.trialDaysLeft ?? 0 })}
          </div>
        )}
        {licenseStatus.type === 'none' && (
          <div className="balance-badge" style={{ opacity: 0.5 }}>{t('not_activated')}</div>
        )}
      </div>
    </aside>
  )
}
