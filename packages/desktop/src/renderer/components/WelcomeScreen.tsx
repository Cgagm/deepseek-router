import { useChatStore } from '../store/chat'
import { useT } from '../i18n'

export default function WelcomeScreen() {
  const t = useT()
  const newSession = useChatStore(s => s.newSession)
  const addMessage = useChatStore(s => s.addMessage)
  const setLoading = useChatStore(s => s.setLoading)
  const setError = useChatStore(s => s.setError)
  const appendToLastMessage = useChatStore(s => s.appendToLastMessage)

  const QUICK_ACTIONS = [
    { labelKey: 'write_doc' as const, icon: '📝', promptKey: 'prompt_write_doc' as const },
    { labelKey: 'analyze_data' as const, icon: '📊', promptKey: 'prompt_analyze_data' as const },
    { labelKey: 'write_email' as const, icon: '📧', promptKey: 'prompt_write_email' as const },
    { labelKey: 'research' as const, icon: '🔍', promptKey: 'prompt_research' as const },
    { labelKey: 'translate' as const, icon: '🌐', promptKey: 'prompt_translate' as const },
    { labelKey: 'organize_notes' as const, icon: '📋', promptKey: 'prompt_organize_notes' as const },
    { labelKey: 'create_ppt' as const, icon: '🎯', promptKey: 'prompt_create_ppt' as const },
    { labelKey: 'draft_contract' as const, icon: '📄', promptKey: 'prompt_draft_contract' as const },
  ]

  const handleQuickAction = async (prompt: string) => {
    let sessionId = useChatStore.getState().activeSessionId
    if (!sessionId) sessionId = newSession()

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: prompt,
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setLoading(true)
    setError(null)

    try {
      const response = await window.api.chat.send({
        messages: [{ role: userMsg.role, content: userMsg.content }],
        stream: true,
      })

      if (response.streaming) {
        const cleanupChunk = window.api.chat.onStreamChunk((chunk: string) => {
          appendToLastMessage(chunk)
        })
        const cleanupDone = window.api.chat.onStreamDone((msg) => {
          cleanupChunk()
          cleanupDone()
          const store = useChatStore.getState()
          store.addMessage({
            id: msg.id,
            role: 'assistant',
            content: msg.content,
            timestamp: Date.now(),
            provider: msg.provider,
            model: msg.model,
            tokens: msg.tokens,
          })
          setLoading(false)
        })
        const cleanupError = window.api.chat.onStreamError((err: string) => {
          cleanupChunk()
          cleanupDone()
          cleanupError()
          setError(err)
          setLoading(false)
        })
      } else {
        addMessage({
          id: response.id,
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          provider: response.provider,
          model: response.model,
          tokens: response.tokens?.completion,
        })
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="chat-welcome">
      <div className="chat-welcome-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <h1 className="chat-welcome-title">{t('welcome_title')}</h1>
      <p className="chat-welcome-subtitle">{t('welcome_subtitle')}</p>

      <div className="quick-actions">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.labelKey}
            className="quick-action-card"
            onClick={() => handleQuickAction(t(action.promptKey))}
          >
            <div className="quick-action-icon">{action.icon}</div>
            <div className="quick-action-label">{t(action.labelKey)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
