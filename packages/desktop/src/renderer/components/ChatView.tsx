import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chat'
import ChatInput from './ChatInput'
import WelcomeScreen from './WelcomeScreen'
import MessageBubble from './MessageBubble'

export default function ChatView() {
  const messages = useChatStore(s => s.messages)
  const isLoading = useChatStore(s => s.isLoading)
  const error = useChatStore(s => s.error)
  const activeSessionId = useChatStore(s => s.activeSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (!activeSessionId) {
    return (
      <div className="chat-container">
        <WelcomeScreen />
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && <WelcomeScreen />}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="message-row">
            <div className="message-avatar ai">AI</div>
            <div className="message-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="typing-dot" style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)',
                animation: 'pulseGlow 1.4s ease-in-out infinite',
              }} />
              <span className="typing-dot" style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)',
                animation: 'pulseGlow 1.4s ease-in-out 0.2s infinite',
              }} />
              <span className="typing-dot" style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)',
                animation: 'pulseGlow 1.4s ease-in-out 0.4s infinite',
              }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: 'var(--space-3)', margin: 'var(--space-2)',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error)',
            fontSize: 'var(--text-sm)',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput />
    </div>
  )
}
