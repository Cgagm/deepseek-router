// Shared types between main and renderer processes

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  provider?: string
  model?: string
  tokens?: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

export interface ChatResponse {
  id: string
  content: string
  provider: string
  model: string
  tokens: { prompt: number; completion: number }
  streaming?: boolean
}

export interface Skill {
  id: string
  name: string
  description: string
  category: 'office' | 'student' | 'business' | 'general'
  icon: string
  prompt: string
  tools: string[]
}

export interface Template {
  id: string
  name: string
  description: string
  category: string
  content: string
  icon: string
}

export interface LicenseStatus {
  activated: boolean
  type: 'buyout' | 'token' | 'trial' | 'none'
  expiresAt: string | null
  deviceId: string
  trialDaysLeft?: number
  trialChatsUsed?: number
}
