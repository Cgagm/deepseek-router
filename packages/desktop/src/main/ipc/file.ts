import { ipcMain, dialog, app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'

export function setupFileIPC(): void {
  ipcMain.handle(
    'file:openDialog',
    async (
      _event,
      options?: {
        filters?: { name: string; extensions: string[] }[]
      },
    ) => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters || [
          { name: '所有文件', extensions: ['*'] },
          {
            name: '文档',
            extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md'],
          },
          { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
        ],
      })
      return result.canceled ? null : result.filePaths
    },
  )

  ipcMain.handle('file:readAsBase64', (_event, filePath: string) => {
    const buffer = readFileSync(filePath)
    return buffer.toString('base64')
  })

  ipcMain.handle('file:readAsText', (_event, filePath: string) => {
    return readFileSync(filePath, 'utf-8')
  })
}

export function setupAppIPC(): void {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:getPlatform', () => {
    return process.platform
  })

  ipcMain.handle('app:checkUpdate', async () => {
    // Stub for auto-update
    return { hasUpdate: false }
  })
}
