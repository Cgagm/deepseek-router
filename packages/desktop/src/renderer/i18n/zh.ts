const zh = {
  // App
  app_name: '摸鱼',
  app_short: '摸鱼',
  app_name_en: 'Moyu',

  // Sidebar
  new_chat: '新对话',
  chat_history: '对话历史',
  no_conversations: '暂无对话记录',
  features: '功能区',
  skills_center: '技能中心',
  templates: '模板库',
  buyout: '买断版',
  not_activated: '未激活',
  trial_days: '试用 {days}天',

  // Header
  settings: '设置',
  minimize: '最小化',
  maximize: '最大化',
  close: '关闭',

  // Welcome
  welcome_title: '你好，我是摸鱼智能助手',
  welcome_subtitle:
    '我可以帮你写文档、分析数据、写邮件、查资料、翻译、整理笔记、做PPT、写合同……直接告诉我你想做什么。',

  // Quick actions
  write_doc: '写文档',
  analyze_data: '分析数据',
  write_email: '写邮件',
  research: '查资料',
  translate: '翻译',
  organize_notes: '整理笔记',
  create_ppt: '做PPT',
  draft_contract: '写合同',
  // Quick action prompts
  prompt_write_doc: '帮我写一份工作文档',
  prompt_analyze_data: '帮我分析以下数据',
  prompt_write_email: '帮我写一封工作邮件',
  prompt_research: '帮我搜索并总结以下主题',
  prompt_translate: '帮我翻译以下内容',
  prompt_organize_notes: '帮我将以下内容整理为结构化笔记',
  prompt_create_ppt: '帮我生成一份PPT大纲',
  prompt_draft_contract: '帮我起草一份合同/协议',

  // Chat Input
  input_placeholder: '输入你想做的事情... (Enter 发送, Shift+Enter 换行)',
  add_file: '添加文件',
  send: '发送',
  file_selected: '[已选择文件: {filename}]',
  current_model: '当前模型: 智能自动 ⚡',

  // Message Bubble
  me: '我',
  tokens: 'tokens',

  // Settings
  settings_title: '设置',
  tab_general: '通用',
  tab_models: '模型配置',
  tab_license: '激活管理',
  tab_about: '关于',

  // Settings - General
  theme_appearance: '主题外观',

  // Settings - Models
  api_key_config: 'API Key 配置（买断版用户填写自己的 Key）',
  provider_deepseek_name: 'DeepSeek',
  provider_deepseek_desc: '综合性价比最高，写作和代码强',
  provider_kimi_name: 'Kimi (月之暗面)',
  provider_kimi_desc: '128K超长上下文，法律逻辑强',
  provider_qwen_name: '千问 (阿里)',
  provider_qwen_desc: '多语言翻译能力强',
  provider_zhipu_name: '智谱GLM',
  provider_zhipu_desc: '数据分析和表格处理强',
  input_api_key: '输入 {name} API Key...',

  // Settings - License
  license_info:
    '买断版激活码格式：CC2-BUY-XXXX-XXXX-XXXX\nToken版激活码格式：CC2-TOK-XXXX-XXXX-XXXX',
  input_activation_code: '输入激活码...',
  activate: '激活',

  // Settings - About
  about_title: '关于摸鱼',
  about_version: '版本：',
  about_tech: '技术栈：',
  about_tech_value: 'Electron + React + TypeScript',
  about_engine: '核心引擎：',
  about_models: '支持模型：',
  about_models_value: 'DeepSeek, Kimi, 千问, 智谱GLM',
  about_skills: '内置技能：',
  about_skills_value: '20个 (办公7 + 学生4 + 个体4 + 通用5)',
  about_privacy: '本地运行，数据不上传服务器。一次性购买，永久使用。',

  // Skills View
  skills_title: '技能中心',
  skills_subtitle: '20个内置技能，覆盖办公、学习、个体经营全场景',
  all_count: '全部 ({count})',
  no_skills_found: '暂未找到相关技能',

  // Skill categories
  cat_office: '办公必备',
  cat_student: '学生专用',
  cat_business: '个体/一人公司',
  cat_general: '通用工具',

  // Skill names & descriptions
  skill_ppt_full: 'PPT全套',
  skill_ppt_full_desc: '根据主题自动生成完整PPT大纲和内容',
  skill_pdf_toolbox: 'PDF工具箱',
  skill_pdf_toolbox_desc: 'PDF合并/拆分/转换/提取文字',
  skill_word_full: 'Word全套',
  skill_word_full_desc: '文档排版/校对/格式转换/模板套用',
  skill_excel_smart: 'Excel智能处理',
  skill_excel_smart_desc: '公式生成/数据分析/图表制作/格式清洗',
  skill_video_dl: '视频无水印下载',
  skill_video_dl_desc: '支持多平台视频无水印下载',
  skill_image_tools: '图片处理',
  skill_image_tools_desc: '批量转换/压缩/裁剪/去背景/水印',
  skill_resume_builder: '简历生成器',
  skill_resume_builder_desc: '根据经历自动生成专业简历',
  skill_paper_assistant: '论文助手',
  skill_paper_assistant_desc: '选题/大纲/文献综述/查重降重/格式排版',
  skill_problem_solver: '解题助手',
  skill_problem_solver_desc: '拍照/输入题目，逐步解析并讲解',
  skill_note_organizer: '笔记整理',
  skill_note_organizer_desc: '课堂笔记/会议记录智能整理成结构化文档',
  skill_english_coach: '英语学习',
  skill_english_coach_desc: '单词/语法/口语/写作/翻译全方位辅导',
  skill_contract_quick: '合同快手',
  skill_contract_quick_desc: '智能生成/审查合同，识别风险条款',
  skill_marketing_factory: '营销文案工厂',
  skill_marketing_factory_desc: '小红书/朋友圈/公众号/短视频文案批量生成',
  skill_data_dashboard: '数据看板',
  skill_data_dashboard_desc: '连接数据源，一句话生成可视化报表',
  skill_biz_tax_helper: '工商财税助手',
  skill_biz_tax_helper_desc: '公司注册/税务申报/发票管理/社保公积金',
  skill_pc_automation: '电脑自动化',
  skill_pc_automation_desc: '批量文件处理/定时任务/自动化流程定制',
  skill_search_plus: '联网搜索增强',
  skill_search_plus_desc: '多引擎聚合搜索+AI总结+来源标注',
  skill_design_tools: '设计小工具',
  skill_design_tools_desc: 'Logo生成/配色方案/海报设计/图标制作',
  skill_email_master: '邮件大师',
  skill_email_master_desc: '邮件撰写/润色/翻译/批量发送/模板管理',
  skill_format_converter: '格式转换中心',
  skill_format_converter_desc: '文件格式互转：PDF↔Word↔PPT↔Excel↔图片↔Markdown',

  // Templates View
  templates_title: '模板库',
  templates_subtitle: '10个常用模板，一键开始，快速完成工作',
  all_templates: '全部 ({count})',
  no_templates_found: '暂未找到相关模板',

  // Template categories
  tcat_office: '办公必备',
  tcat_student: '学生专用',
  tcat_business: '个体经营',
  tcat_general: '通用模板',
  tcat_marketing: '营销文案',

  // Template names & descriptions
  tpl_weekly_report: '周报模板',
  tpl_weekly_report_desc: '快速生成每周工作周报',
  tpl_meeting_minutes: '会议纪要',
  tpl_meeting_minutes_desc: '从会议录音/笔记生成标准会议纪要',
  tpl_email_formal: '正式邮件',
  tpl_email_formal_desc: '商务/工作正式邮件模板',
  tpl_ppt_outline: 'PPT大纲',
  tpl_ppt_outline_desc: '快速生成演讲/汇报PPT大纲',
  tpl_translation: '翻译助手',
  tpl_translation_desc: '中英日韩等多语言互译',
  tpl_summary: '内容总结',
  tpl_summary_desc: '长文/文档/网页智能总结',
  tpl_contract_template: '合同模板',
  tpl_contract_template_desc: '常见合同/协议模板生成',
  tpl_social_post: '社媒文案',
  tpl_social_post_desc: '小红书/朋友圈/公众号多平台文案',
  tpl_academic_search: '学术搜索',
  tpl_academic_search_desc: '论文检索/文献综述/引用整理',
  tpl_exam_review: '考试复习',
  tpl_exam_review_desc: '知识点梳理/重点归纳/习题生成',

  // Command Palette
  cmd_placeholder: '搜索技能、切换主题、打开设置...',
  cmd_no_results: '没有找到相关命令',
  cmd_new_chat: '新对话',
  cmd_open_settings: '打开设置',
  cmd_theme_cherry: '切换樱花主题',
  cmd_theme_ocean: '切换深海主题',
  cmd_theme_bamboo: '切换竹林主题',
  cmd_theme_midnight: '切换暗夜主题',
  cmd_theme_sunlight: '切换暖阳主题',
  cmd_category_chat: '对话',
  cmd_category_app: '应用',
  cmd_category_theme: '主题',
  cmd_category_skill: '技能',
  // Command palette skill labels
  cmd_skill_ppt: 'PPT全套',
  cmd_skill_pdf: 'PDF工具箱',
  cmd_skill_word: 'Word全套',
  cmd_skill_excel: 'Excel智能处理',
  cmd_skill_video: '视频下载',
  cmd_skill_image: '图片处理',
  cmd_skill_resume: '简历生成器',
  cmd_skill_paper: '论文助手',
  cmd_skill_contract: '合同快手',
  cmd_skill_search: '联网搜索',
  cmd_skill_email: '邮件大师',
  cmd_skill_convert: '格式转换',
  cmd_skill_automation: '电脑自动化',

  // Theme names
  theme_cherry: '樱花',
  theme_ocean: '深海',
  theme_bamboo: '竹林',
  theme_midnight: '暗夜',
  theme_sunlight: '暖阳',
} as const

export default zh
export type Translations = typeof zh
