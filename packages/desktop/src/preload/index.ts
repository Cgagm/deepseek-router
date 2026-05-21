import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage, ChatSession, ChatResponse, Skill, Template } from '../main/types'

// Type-safe API exposed to renderer via contextBridge
const api = {
  // Chat
  chat: {
    send: (params: {
      messages: ChatMessage[]
      provider?: string
      model?: string
      stream?: boolean
    }): Promise<ChatResponse> => ipcRenderer.invoke('chat:send', params),

    abort: (requestId?: string): void => {
      ipcRenderer.send('chat:abort', requestId)
    },

    onStreamChunk: (cb: (chunk: string) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { requestId: string; chunk: string },
      ) => {
        cb(data.chunk)
      }
      ipcRenderer.on('chat:streamChunk', handler)
      return () => ipcRenderer.removeListener('chat:streamChunk', handler)
    },

    onStreamDone: (cb: (msg: ChatMessage) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { requestId: string; message: ChatMessage },
      ) => {
        cb(data.message)
      }
      ipcRenderer.on('chat:streamDone', handler)
      return () => ipcRenderer.removeListener('chat:streamDone', handler)
    },

    onStreamError: (cb: (err: string) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { requestId: string; error: string },
      ) => {
        cb(data.error)
      }
      ipcRenderer.on('chat:streamError', handler)
      return () => ipcRenderer.removeListener('chat:streamError', handler)
    },
  },

  // Storage
  storage: {
    getChats: (): Promise<ChatSession[]> => ipcRenderer.invoke('storage:getChats'),
    getChat: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke('storage:getChat', id),
    saveChat: (session: ChatSession): Promise<void> =>
      ipcRenderer.invoke('storage:saveChat', session),
    deleteChat: (id: string): Promise<void> => ipcRenderer.invoke('storage:deleteChat', id),
    getSkills: (): Promise<Skill[]> => ipcRenderer.invoke('storage:getSkills'),
    getTemplates: (): Promise<Template[]> => ipcRenderer.invoke('storage:getTemplates'),
    getSetting: (key: string): Promise<string | null> =>
      ipcRenderer.invoke('storage:getSetting', key),
    setSetting: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('storage:setSetting', key, value),
  },

  // License
  license: {
    getStatus: (): Promise<{
      activated: boolean
      type: 'buyout' | 'token' | 'trial' | 'none'
      expiresAt: string | null
      deviceId: string
      trialDaysLeft?: number
      trialChatsUsed?: number
    }> => ipcRenderer.invoke('license:getStatus'),
    activate: (key: string): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('license:activate', key),
    getBalance: (): Promise<{ tokens: number; expiresAt: string | null }> =>
      ipcRenderer.invoke('license:getBalance'),
  },

  // File
  file: {
    openDialog: (options?: {
      filters?: { name: string; extensions: string[] }[]
    }): Promise<string[] | null> => ipcRenderer.invoke('file:openDialog', options),
    readAsBase64: (path: string): Promise<string> => ipcRenderer.invoke('file:readAsBase64', path),
    readAsText: (path: string): Promise<string> => ipcRenderer.invoke('file:readAsText', path),
  },

  // App
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    checkUpdate: (): Promise<{ hasUpdate: boolean; version?: string }> =>
      ipcRenderer.invoke('app:checkUpdate'),
    getPlatform: (): Promise<string> => ipcRenderer.invoke('app:getPlatform'),
    setTheme: (theme: string): void => ipcRenderer.send('app:setTheme', theme),
  },

  // Window
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (isMaximized: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => cb(isMaximized)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type DesktopApi = typeof api
