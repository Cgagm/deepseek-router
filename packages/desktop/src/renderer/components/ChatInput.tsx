import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../store/chat'
import { useT } from '../i18n'

export default function ChatInput() {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const addMessage = useChatStore(s => s.addMessage)
  const setLoading = useChatStore(s => s.setLoading)
  const setError = useChatStore(s => s.setError)
  const appendToLastMessage = useChatStore(s => s.appendToLastMessage)
  const newSession = useChatStore(s => s.newSession)
  const activeSessionId = useChatStore(s => s.activeSessionId)
  const t = useT()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [input])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    let sessionId = activeSessionId
    if (!sessionId) sessionId = newSession()

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    }

    setInput('')
    addMessage(userMsg)
    setLoading(true)
    setError(null)

    try {
      const allMsgs = [...useChatStore.getState().messages]
      const response = await window.api.chat.send({
        messages: allMsgs.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp })),
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
          const msgs = store.messages.filter(m => m.id !== msg.id)
          const finalMsg = {
            id: msg.id,
            role: 'assistant' as const,
            content: msg.content,
            timestamp: Date.now(),
            provider: msg.provider,
            model: msg.model,
            tokens: msg.tokens,
          }
          useChatStore.setState({ messages: [...msgs, finalMsg] })
          setLoading(false)
        })
        const cleanupError = window.api.chat.onStreamError((err: string) => {
          cleanupChunk()
          cleanupDone()
          cleanupError()
          setError(err)
          setLoading(false)
        })
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileOpen = async () => {
    const files = await window.api.file.openDialog()
    if (files && files.length > 0) {
      setInput(prev => prev + `\n${t('file_selected', { filename: files[0] })}`)
    }
  }

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('input_placeholder')}
          rows={1}
          disabled={!activeSessionId}
        />
        <div className="chat-input-actions">
          <button className="input-action-btn" onClick={handleFileOpen} title={t('add_file')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
