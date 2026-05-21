import { useMemo } from 'react'

import { useT } from '../i18n'

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const t = useT()

  const renderedContent = useMemo(() => {
    let content = message.content
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    content = content.replace(/\*(.+?)\*/g, '<em>$1</em>')
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>')
    return content
  }, [message.content])

  return (
    <div className={`message-row ${isUser ? 'user' : ''}`}>
      <div className={`message-avatar ${isUser ? '' : 'ai'}`}>
        {isUser ? t('me') : 'AI'}
      </div>
      <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
        <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
        {message.provider && !isUser && (
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
            marginTop: 'var(--space-1)', opacity: 0.7,
          }}>
            {message.provider} / {message.model}
            {message.tokens && ` · ${message.tokens} ${t('tokens')}`}
          </div>
        )}
      </div>
    </div>
  )
}
