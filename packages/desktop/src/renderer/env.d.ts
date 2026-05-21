/// <reference types="vite/client" />

interface Window {
  api: {
    // Chat
    chat: {
      send: (params: {
        messages: ChatMessage[]
        provider?: string
        model?: string
        stream?: boolean
      }) => Promise<ChatResponse>
      abort: () => void
      onStreamChunk: (cb: (chunk: string) => void) => () => void
      onStreamDone: (cb: (msg: ChatMessage) => void) => () => void
      onStreamError: (cb: (err: string) => void) => () => void
    }
    // Storage
    storage: {
      getChats: () => Promise<ChatSession[]>
      getChat: (id: string) => Promise<ChatSession | null>
      saveChat: (session: ChatSession) => Promise<void>
      deleteChat: (id: string) => Promise<void>
      getSkills: () => Promise<Skill[]>
      getTemplates: () => Promise<Template[]>
      getSetting: (key: string) => Promise<string | null>
      setSetting: (key: string, value: string) => Promise<void>
    }
    // License
    license: {
      getStatus: () => Promise<LicenseStatus>
      activate: (key: string) => Promise<{ success: boolean; message: string }>
      getBalance: () => Promise<{ tokens: number; expiresAt: string | null }>
    }
    // File
    file: {
      openDialog: (options?: {
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<string[] | null>
      readAsBase64: (path: string) => Promise<string>
      readAsText: (path: string) => Promise<string>
    }
    // App
    app: {
      getVersion: () => Promise<string>
      checkUpdate: () => Promise<{ hasUpdate: boolean; version?: string }>
      getPlatform: () => Promise<string>
      setTheme: (theme: string) => void
    }
    // Window controls
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  provider?: string
  model?: string
  tokens?: number
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

interface ChatResponse {
  id: string
  content: string
  provider: string
  model: string
  streaming: boolean
  tokens: { prompt: number; completion: number }
}

interface Skill {
  id: string
  name: string
  description: string
  category: string
  icon: string
  prompt: string
  tools?: string[]
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  content: string
  icon: string
}

interface LicenseStatus {
  activated: boolean
  type: 'buyout' | 'token' | 'trial' | 'none'
  expiresAt: string | null
  deviceId: string
  trialDaysLeft?: number
  trialChatsUsed?: number
}

declare module '*.css'
declare module '*.svg' {
  const content: string
  export default content
}
