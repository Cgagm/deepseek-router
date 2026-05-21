import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { hostname, platform, arch, cpus } from 'os'
import { getDatabase, serializeDatabase } from '../database/schema'

interface LicenseStatus {
  activated: boolean
  type: 'buyout' | 'token' | 'trial' | 'none'
  expiresAt: string | null
  deviceId: string
  trialDaysLeft?: number
  trialChatsUsed?: number
}

const TRIAL_MAX_DAYS = 7
const TRIAL_MAX_CHATS_PER_DAY = 10

function getDeviceId(): string {
  const parts = [hostname(), platform(), arch(), cpus()?.[0]?.model || 'unknown']
  return createHash('sha256').update(parts.join('-')).digest('hex').substring(0, 16)
}

export function setupLicenseIPC(): void {
  ipcMain.handle('license:getStatus', () => {
    const db = getDatabase()
    const deviceId = getDeviceId()

    const result = db.exec("SELECT type, device_id, token_balance, activated_at, expires_at FROM license LIMIT 1")
    if (!result.length || !result[0].values.length) {
      // No license record - start trial
      const now = Date.now()
      db.run("INSERT INTO license (key, type, device_id, token_balance, activated_at, expires_at) VALUES (?,?,?,?,?,?)",
        ['default', 'trial', deviceId, 0, now, now + TRIAL_MAX_DAYS * 86400000])

      return {
        activated: false,
        type: 'trial',
        expiresAt: new Date(now + TRIAL_MAX_DAYS * 86400000).toISOString(),
        deviceId,
        trialDaysLeft: TRIAL_MAX_DAYS,
        trialChatsUsed: 0,
      }
    }

    const row = result[0].values[0]
    const type = row[0] as string
    const storedDeviceId = row[1] as string
    const tokenBalance = row[2] as number
    const activatedAt = row[3] as number
    const expiresAt = row[4] as number

    if (type === 'buyout' && storedDeviceId !== deviceId) {
      return {
        activated: false, type: 'none' as const,
        expiresAt: null, deviceId,
      }
    }

    const status: LicenseStatus = {
      activated: type !== 'none' && type !== 'trial',
      type: type as LicenseStatus['type'],
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      deviceId,
    }

    if (type === 'trial') {
      const now = Date.now()
      if (expiresAt && now > expiresAt) {
        return { ...status, activated: false, type: 'none' as const, trialDaysLeft: 0, trialChatsUsed: TRIAL_MAX_CHATS_PER_DAY }
      }
      status.trialDaysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000))

      // Count today's chats
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const chatResult = db.exec(
        "SELECT COUNT(*) FROM chat_sessions WHERE created_at >= ?",
        [todayStart.getTime()]
      )
      status.trialChatsUsed = chatResult.length > 0 ? (chatResult[0].values[0][0] as number) : 0
    }

    return status
  })

  ipcMain.handle('license:activate', (_event, key: string) => {
    const db = getDatabase()
    const deviceId = getDeviceId()

    // Simulate activation key validation
    if (key.startsWith('CC2-BUY-') || key.startsWith('CC2-TOK-')) {
      const type = key.startsWith('CC2-BUY-') ? 'buyout' : 'token'
      const now = Date.now()

      db.run("DELETE FROM license")
      db.run(
        "INSERT INTO license (key, type, device_id, token_balance, activated_at, expires_at) VALUES (?,?,?,?,?,?)",
        [key, type, deviceId, type === 'token' ? 500000 : 0, now, type === 'token' ? now + 365 * 86400000 : null]
      )

      return { success: true, message: type === 'buyout' ? '买断版激活成功！永久使用' : 'Token版激活成功！50万Token已到账' }
    }

    return { success: false, message: '激活码无效，请检查输入' }
  })

  ipcMain.handle('license:getBalance', () => {
    const db = getDatabase()
    const result = db.exec("SELECT type, token_balance, expires_at FROM license LIMIT 1")
    if (!result.length || !result[0].values.length) {
      return { tokens: 0, expiresAt: null }
    }
    const row = result[0].values[0]
    return {
      tokens: row[1] as number,
      expiresAt: row[2] ? new Date(row[2] as number).toISOString() : null,
    }
  })

  ipcMain.handle('license:deductTokens', (_event, amount: number) => {
    const db = getDatabase()
    const result = db.exec("SELECT token_balance FROM license LIMIT 1")
    if (!result.length || !result[0].values.length) return false
    const balance = result[0].values[0][0] as number
    if (balance < amount) return false
    db.run("UPDATE license SET token_balance = ?", [balance - amount])
    return true
  })
}
