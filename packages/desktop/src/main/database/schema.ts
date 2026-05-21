import initSqlJs from 'sql.js'
import type { SqlJsStatic, Database as SqlJsDatabase } from 'sql.js'

let SQL: SqlJsStatic | null = null
let db: SqlJsDatabase | null = null

export async function initDatabase(): Promise<SqlJsDatabase> {
  SQL = await initSqlJs()
  db = new SQL.Database()

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      pinned INTEGER DEFAULT 0
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT NOT NULL,
      prompt TEXT NOT NULL,
      tools TEXT DEFAULT '[]'
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      icon TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS license (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'none',
      device_id TEXT,
      token_balance INTEGER DEFAULT 0,
      activated_at INTEGER,
      expires_at INTEGER
    )
  `)

  seedSkills()
  seedTemplates()

  return db
}

function seedSkills(): void {
  if (!db || !SQL) return
  const count = db.exec("SELECT COUNT(*) FROM skills")
  if (count.length > 0 && (count[0].values[0][0] as number) > 0) return

  const skills: [string, string, string, string, string, string, string][] = [
    ['ppt-full', 'PPT全套', '根据主题自动生成完整PPT大纲和内容', 'office', 'presentation', '为以下主题生成一套完整的PPT大纲和内容：{input}。包含封面、目录、每页要点、总结。', '[]'],
    ['pdf-toolbox', 'PDF工具箱', 'PDF合并/拆分/转换/提取文字', 'office', 'file-pdf', '处理PDF文件：{input}', '["pdf_parse","pdf_merge","pdf_split"]'],
    ['word-full', 'Word全套', '文档排版/校对/格式转换/模板套用', 'office', 'file-text', '处理Word文档：{input}', '["docx_parse","docx_create","format_text"]'],
    ['excel-smart', 'Excel智能处理', '公式生成/数据分析/图表制作/格式清洗', 'office', 'table', '处理Excel数据：{input}', '["xlsx_parse","xlsx_create","data_analysis","chart"]'],
    ['video-dl', '视频无水印下载', '支持多平台视频无水印下载', 'office', 'video', '下载视频：{input}', '["video_download"]'],
    ['image-tools', '图片处理', '批量转换/压缩/裁剪/去背景/水印', 'office', 'image', '处理图片：{input}', '["image_crop","image_compress","image_convert","remove_bg"]'],
    ['resume-builder', '简历生成器', '根据经历自动生成专业简历', 'office', 'file-user', '根据以下经历生成专业简历：{input}', '[]'],
    ['paper-assistant', '论文助手', '选题/大纲/文献综述/查重降重/格式排版', 'student', 'book-open', '论文相关任务：{input}', '[]'],
    ['problem-solver', '解题助手', '拍照/输入题目，逐步解析并讲解', 'student', 'calculator', '解答以下题目，给出详细步骤：{input}', '[]'],
    ['note-organizer', '笔记整理', '课堂笔记/会议记录智能整理成结构化文档', 'student', 'clipboard', '将以下笔记整理为结构化文档：{input}', '[]'],
    ['english-coach', '英语学习', '单词/语法/口语/写作/翻译全方位辅导', 'student', 'languages', '英语学习任务：{input}', '[]'],
    ['contract-quick', '合同快手', '智能生成/审查合同，识别风险条款', 'business', 'scale', '合同相关任务：{input}', '[]'],
    ['marketing-factory', '营销文案工厂', '小红书/朋友圈/公众号/短视频文案批量生成', 'business', 'megaphone', '生成营销文案，根据平台风格适配：{input}', '[]'],
    ['data-dashboard', '数据看板', '连接数据源，一句话生成可视化报表', 'business', 'chart-bar', '根据数据生成报表：{input}', '["data_analysis","chart"]'],
    ['biz-tax-helper', '工商财税助手', '公司注册/税务申报/发票管理/社保公积金', 'business', 'building', '工商财税问题：{input}', '[]'],
    ['pc-automation', '电脑自动化', '批量文件处理/定时任务/自动化流程定制', 'general', 'cpu', '自动化任务：{input}', '["file_ops","shell_exec"]'],
    ['search-plus', '联网搜索增强', '多引擎聚合搜索+AI总结+来源标注', 'general', 'search', '搜索并总结：{input}', '["web_search"]'],
    ['design-tools', '设计小工具', 'Logo生成/配色方案/海报设计/图标制作', 'general', 'palette', '设计任务：{input}', '[]'],
    ['email-master', '邮件大师', '邮件撰写/润色/翻译/批量发送/模板管理', 'general', 'mail', '邮件相关任务：{input}', '[]'],
    ['format-converter', '格式转换中心', '文件格式互转：PDF↔Word↔PPT↔Excel↔图片↔Markdown', 'general', 'shuffle', '转换文件格式：{input}', '["pdf_convert","docx_convert","xlsx_convert","image_convert"]'],
  ]

  const stmt = db.prepare("INSERT OR IGNORE INTO skills VALUES (?,?,?,?,?,?,?)")
  for (const s of skills) {
    stmt.run(s)
  }
  stmt.free()
}

function seedTemplates(): void {
  if (!db || !SQL) return
  const count = db.exec("SELECT COUNT(*) FROM templates")
  if (count.length > 0 && (count[0].values[0][0] as number) > 0) return

  const templates: [string, string, string, string, string, string][] = [
    ['weekly-report', '周报模板', '快速生成每周工作周报', 'office', '本周工作内容：{input}\n\n请根据以上内容生成一份结构化的周报，包含：本周完成工作、下周计划、需要协调事项。', 'calendar'],
    ['meeting-minutes', '会议纪要', '从会议录音/笔记生成标准会议纪要', 'office', '会议内容：{input}\n\n请整理为正式会议纪要，包含：会议主题、时间地点、参会人员、讨论事项、决议、待办事项。', 'users'],
    ['email-formal', '正式邮件', '商务/工作正式邮件模板', 'office', '邮件要点：{input}\n\n请写一封正式的工作邮件，语气专业得体，包含恰当地称呼、正文、落款。', 'mail'],
    ['ppt-outline', 'PPT大纲', '快速生成演讲/汇报PPT大纲', 'office', 'PPT主题：{input}\n\n请生成一个完整的PPT大纲，包括每页标题和3-5个要点，共12-16页。', 'presentation'],
    ['translation', '翻译助手', '中英日韩等多语言互译', 'general', '请将以下内容翻译：{input}', 'languages'],
    ['summary', '内容总结', '长文/文档/网页智能总结', 'general', '请总结以下内容的核心要点（300字以内）：{input}', 'file-text'],
    ['contract-template', '合同模板', '常见合同/协议模板生成', 'business', '请根据以下需求生成一份合同/协议模板：{input}', 'scale'],
    ['social-post', '社媒文案', '小红书/朋友圈/公众号多平台文案', 'marketing', '请根据以下内容生成适合{platform}的推广文案：{input}', 'share-2'],
    ['academic-search', '学术搜索', '论文检索/文献综述/引用整理', 'student', '学术搜索需求：{input}\n\n请检索相关学术资料并给出综述，注明引用来源。', 'search'],
    ['exam-review', '考试复习', '知识点梳理/重点归纳/习题生成', 'student', '考试科目：{input}\n\n请梳理核心知识点，归纳重点，并生成练习题。', 'book-open'],
  ]

  const stmt = db.prepare("INSERT OR IGNORE INTO templates VALUES (?,?,?,?,?,?)")
  for (const t of templates) {
    stmt.run(t)
  }
  stmt.free()
}

export function getDatabase(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function serializeDatabase(): Uint8Array {
  return getDatabase().export()
}

export function loadDatabase(data: Uint8Array): void {
  if (!SQL) throw new Error('sql.js not initialized')
  db = new SQL.Database(data)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
