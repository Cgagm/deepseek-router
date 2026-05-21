import { create } from 'zustand'
import type { ChatMessage, ChatSession } from '../env'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  streamBuffer: string

  setSessions: (sessions: ChatSession[]) => void
  setActiveSession: (id: string | null) => void
  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (chunk: string) => void
  setLoading: (loading: boolean) => void
  setError: (err: string | null) => void
  newSession: () => string
  clearMessages: () => void
}

let msgCounter = 0

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isLoading: false,
  error: null,
  streamBuffer: '',

  setSessions: (sessions) => set({ sessions }),

  setActiveSession: (id) => {
    const session = get().sessions.find((s) => s.id === id)
    set({ activeSessionId: id, messages: session?.messages || [], streamBuffer: '' })
  },

  addMessage: (msg) => {
    const updated = [...get().messages, msg]
    set({ messages: updated, streamBuffer: '' })

    // Save to current session
    const { activeSessionId, sessions } = get()
    if (activeSessionId) {
      const idx = sessions.findIndex((s) => s.id === activeSessionId)
      if (idx >= 0) {
        const updatedSessions = [...sessions]
        updatedSessions[idx] = {
          ...updatedSessions[idx],
          messages: updated,
          updatedAt: Date.now(),
        }
        if (updated.length === 2 && msg.role === 'assistant') {
          updatedSessions[idx].title = updated[0].content.substring(0, 50)
        }
        set({ sessions: updatedSessions })
        // Persist
        window.api.storage.saveChat(updatedSessions[idx])
      }
    }
  },

  appendToLastMessage: (chunk) => {
    const { messages, streamBuffer } = get()
    const newStream = streamBuffer + chunk
    set({ streamBuffer: newStream })

    const msgs = [...messages]
    const last = msgs[msgs.length - 1]
    if (last && last.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      set({ messages: msgs })
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (err) => set({ error: err }),

  newSession: () => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const session: ChatSession = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const sessions = [session, ...get().sessions]
    set({ sessions, activeSessionId: id, messages: [], streamBuffer: '' })
    window.api.storage.saveChat(session)
    return id
  },

  clearMessages: () => {
    set({ messages: [], streamBuffer: '' })
  },
}))
