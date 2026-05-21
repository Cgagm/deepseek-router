import { ipcMain, BrowserWindow } from 'electron'
import { getDatabase, serializeDatabase } from '../database/schema'
import type { ChatSession } from '../types'

export function setupStorageIPC(): void {
  // Chat sessions
  ipcMain.handle('storage:getChats', () => {
    const db = getDatabase()
    const result = db.exec("SELECT id, title, messages, created_at, updated_at, pinned FROM chat_sessions ORDER BY updated_at DESC")
    if (!result.length) return []
    const rows: ChatSession[] = []
    for (const row of result[0].values) {
      rows.push({
        id: row[0] as string,
        title: row[1] as string,
        messages: JSON.parse(row[2] as string),
        createdAt: row[3] as number,
        updatedAt: row[4] as number,
        pinned: !!(row[5] as number),
      })
    }
    return rows
  })

  ipcMain.handle('storage:getChat', (_event, id: string) => {
    const db = getDatabase()
    const result = db.exec("SELECT id, title, messages, created_at, updated_at, pinned FROM chat_sessions WHERE id = ?", [id])
    if (!result.length || !result[0].values.length) return null
    const row = result[0].values[0]
    return {
      id: row[0] as string,
      title: row[1] as string,
      messages: JSON.parse(row[2] as string),
      createdAt: row[3] as number,
      updatedAt: row[4] as number,
      pinned: !!(row[5] as number),
    }
  })

  ipcMain.handle('storage:saveChat', (_event, session: ChatSession) => {
    const db = getDatabase()
    db.run(
      "INSERT OR REPLACE INTO chat_sessions (id, title, messages, created_at, updated_at, pinned) VALUES (?,?,?,?,?,?)",
      [session.id, session.title, JSON.stringify(session.messages), session.createdAt, session.updatedAt, session.pinned ? 1 : 0]
    )
    const data = serializeDatabase()
    return data
  })

  ipcMain.handle('storage:deleteChat', (_event, id: string) => {
    const db = getDatabase()
    db.run("DELETE FROM chat_sessions WHERE id = ?", [id])
    return serializeDatabase()
  })

  // Skills
  ipcMain.handle('storage:getSkills', () => {
    const db = getDatabase()
    const result = db.exec("SELECT id, name, description, category, icon, prompt, tools FROM skills ORDER BY id")
    if (!result.length) return []
    return result[0].values.map(row => ({
      id: row[0], name: row[1], description: row[2],
      category: row[3], icon: row[4], prompt: row[5],
      tools: JSON.parse(row[6] as string),
    }))
  })

  // Templates
  ipcMain.handle('storage:getTemplates', () => {
    const db = getDatabase()
    const result = db.exec("SELECT id, name, description, category, content, icon FROM templates ORDER BY id")
    if (!result.length) return []
    return result[0].values.map(row => ({
      id: row[0], name: row[1], description: row[2],
      category: row[3], content: row[4], icon: row[5],
    }))
  })

  // Settings
  ipcMain.handle('storage:getSetting', (_event, key: string) => {
    const db = getDatabase()
    const result = db.exec("SELECT value FROM settings WHERE key = ?", [key])
    if (!result.length || !result[0].values.length) return null
    return result[0].values[0][0] as string
  })

  ipcMain.handle('storage:setSetting', (_event, key: string, value: string) => {
    const db = getDatabase()
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", [key, value])
    return serializeDatabase()
  })
}
