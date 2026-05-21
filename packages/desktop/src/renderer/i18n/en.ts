import type { Translations } from './zh'

const en: Translations = {
  // App
  app_name: 'Moyu',
  app_short: 'Moyu',
  app_name_en: 'Moyu',

  // Sidebar
  new_chat: 'New Chat',
  chat_history: 'Chat History',
  no_conversations: 'No conversations yet',
  features: 'Features',
  skills_center: 'Skills Center',
  templates: 'Templates',
  buyout: 'Buyout',
  not_activated: 'Not Activated',
  trial_days: 'Trial {days}d',

  // Header
  settings: 'Settings',
  minimize: 'Minimize',
  maximize: 'Maximize',
  close: 'Close',

  // Welcome
  welcome_title: "Hello, I'm Moyu Smart Assistant",
  welcome_subtitle:
    'I can help you write docs, analyze data, draft emails, research topics, translate, organize notes, create presentations, draft contracts... Just tell me what you need.',

  // Quick actions
  write_doc: 'Write Doc',
  analyze_data: 'Analyze Data',
  write_email: 'Write Email',
  research: 'Research',
  translate: 'Translate',
  organize_notes: 'Organize Notes',
  create_ppt: 'Create PPT',
  draft_contract: 'Draft Contract',
  // Quick action prompts
  prompt_write_doc: 'Help me write a work document',
  prompt_analyze_data: 'Help me analyze the following data',
  prompt_write_email: 'Help me write a work email',
  prompt_research: 'Help me search and summarize the following topic',
  prompt_translate: 'Help me translate the following content',
  prompt_organize_notes: 'Help me organize the following into structured notes',
  prompt_create_ppt: 'Help me generate a PPT outline',
  prompt_draft_contract: 'Help me draft a contract/agreement',

  // Chat Input
  input_placeholder: 'Type what you want to do... (Enter to send, Shift+Enter for new line)',
  add_file: 'Add File',
  send: 'Send',
  file_selected: '[File selected: {filename}]',
  current_model: 'Model: Smart Auto ⚡',

  // Message Bubble
  me: 'Me',
  tokens: 'tokens',

  // Settings
  settings_title: 'Settings',
  tab_general: 'General',
  tab_models: 'Model Config',
  tab_license: 'License',
  tab_about: 'About',

  // Settings - General
  theme_appearance: 'Theme Appearance',

  // Settings - Models
  api_key_config: 'API Key Configuration (buyout users fill in their own keys)',
  provider_deepseek_name: 'DeepSeek',
  provider_deepseek_desc: 'Best overall value, strong at writing and coding',
  provider_kimi_name: 'Kimi (Moonshot)',
  provider_kimi_desc: '128K super-long context, strong legal reasoning',
  provider_qwen_name: 'Qwen (Alibaba)',
  provider_qwen_desc: 'Strong multilingual translation',
  provider_zhipu_name: 'Zhipu GLM',
  provider_zhipu_desc: 'Strong data analysis and spreadsheet processing',
  input_api_key: 'Enter {name} API Key...',

  // Settings - License
  license_info:
    'Buyout code format: CC2-BUY-XXXX-XXXX-XXXX\nToken code format: CC2-TOK-XXXX-XXXX-XXXX',
  input_activation_code: 'Enter activation code...',
  activate: 'Activate',

  // Settings - About
  about_title: 'About Moyu',
  about_version: 'Version: ',
  about_tech: 'Tech Stack: ',
  about_tech_value: 'Electron + React + TypeScript',
  about_engine: 'Core Engine: ',
  about_models: 'Supported Models: ',
  about_models_value: 'DeepSeek, Kimi, Qwen, Zhipu GLM',
  about_skills: 'Built-in Skills: ',
  about_skills_value: '20 (Office 7 + Student 4 + Business 4 + General 5)',
  about_privacy: 'Runs locally, data never uploaded. Buy once, use forever.',

  // Skills View
  skills_title: 'Skills Center',
  skills_subtitle: '20 built-in skills covering office, study, and business scenarios',
  all_count: 'All ({count})',
  no_skills_found: 'No skills found',

  // Skill categories
  cat_office: 'Office',
  cat_student: 'Student',
  cat_business: 'Solo Business',
  cat_general: 'General Tools',

  // Skill names & descriptions
  skill_ppt_full: 'PPT Generator',
  skill_ppt_full_desc: 'Auto-generate complete PPT outline and content from a topic',
  skill_pdf_toolbox: 'PDF Toolbox',
  skill_pdf_toolbox_desc: 'PDF merge/split/convert/text extraction',
  skill_word_full: 'Word Suite',
  skill_word_full_desc: 'Document formatting, proofreading, format conversion, templates',
  skill_excel_smart: 'Excel Smart Processing',
  skill_excel_smart_desc: 'Formula generation, data analysis, charts, data cleaning',
  skill_video_dl: 'Video Downloader',
  skill_video_dl_desc: 'Multi-platform watermark-free video download',
  skill_image_tools: 'Image Tools',
  skill_image_tools_desc: 'Batch convert, compress, crop, remove background, watermark',
  skill_resume_builder: 'Resume Builder',
  skill_resume_builder_desc: 'Auto-generate professional resumes from your experience',
  skill_paper_assistant: 'Paper Assistant',
  skill_paper_assistant_desc: 'Topic selection, outline, literature review, formatting',
  skill_problem_solver: 'Problem Solver',
  skill_problem_solver_desc: 'Step-by-step solution explanation with detailed steps',
  skill_note_organizer: 'Note Organizer',
  skill_note_organizer_desc: 'Smart organization of lecture notes and meeting minutes',
  skill_english_coach: 'English Coach',
  skill_english_coach_desc: 'Vocabulary, grammar, speaking, writing, translation tutoring',
  skill_contract_quick: 'Contract Express',
  skill_contract_quick_desc: 'Smart contract generation and review, risk identification',
  skill_marketing_factory: 'Marketing Copy Factory',
  skill_marketing_factory_desc: 'Batch copywriting for XHS, Moments, WeChat, short video',
  skill_data_dashboard: 'Data Dashboard',
  skill_data_dashboard_desc: 'Connect data sources, one-sentence visual report generation',
  skill_biz_tax_helper: 'Business & Tax Helper',
  skill_biz_tax_helper_desc: 'Company registration, tax filing, invoices, social security',
  skill_pc_automation: 'PC Automation',
  skill_pc_automation_desc: 'Batch file processing, scheduled tasks, custom automation',
  skill_search_plus: 'Enhanced Web Search',
  skill_search_plus_desc: 'Multi-engine aggregated search with AI summary and citations',
  skill_design_tools: 'Design Tools',
  skill_design_tools_desc: 'Logo generation, color schemes, posters, icon creation',
  skill_email_master: 'Email Master',
  skill_email_master_desc: 'Email drafting, polishing, translation, batch sending, templates',
  skill_format_converter: 'Format Converter',
  skill_format_converter_desc: 'Cross-format conversion: PDF↔Word↔PPT↔Excel↔Images↔Markdown',

  // Templates View
  templates_title: 'Templates',
  templates_subtitle: '10 common templates, one click to start, get work done fast',
  all_templates: 'All ({count})',
  no_templates_found: 'No templates found',

  // Template categories
  tcat_office: 'Office',
  tcat_student: 'Student',
  tcat_business: 'Business',
  tcat_general: 'General',
  tcat_marketing: 'Marketing',

  // Template names & descriptions
  tpl_weekly_report: 'Weekly Report',
  tpl_weekly_report_desc: 'Quickly generate weekly work reports',
  tpl_meeting_minutes: 'Meeting Minutes',
  tpl_meeting_minutes_desc: 'Generate standard meeting minutes from recordings/notes',
  tpl_email_formal: 'Formal Email',
  tpl_email_formal_desc: 'Professional business email template',
  tpl_ppt_outline: 'PPT Outline',
  tpl_ppt_outline_desc: 'Quickly generate presentation outline',
  tpl_translation: 'Translator',
  tpl_translation_desc: 'Multi-language translation (CN/EN/JP/KR and more)',
  tpl_summary: 'Summarizer',
  tpl_summary_desc: 'Smart summarization of long articles, documents, web pages',
  tpl_contract_template: 'Contract Template',
  tpl_contract_template_desc: 'Generate common contract templates',
  tpl_social_post: 'Social Media Copy',
  tpl_social_post_desc: 'Multi-platform copywriting for XHS, Moments, WeChat',
  tpl_academic_search: 'Academic Search',
  tpl_academic_search_desc: 'Paper search, literature review, citation management',
  tpl_exam_review: 'Exam Review',
  tpl_exam_review_desc: 'Knowledge mapping, key points summary, practice questions',

  // Command Palette
  cmd_placeholder: 'Search skills, switch theme, open settings...',
  cmd_no_results: 'No commands found',
  cmd_new_chat: 'New Chat',
  cmd_open_settings: 'Open Settings',
  cmd_theme_cherry: 'Switch to Cherry Blossom',
  cmd_theme_ocean: 'Switch to Deep Ocean',
  cmd_theme_bamboo: 'Switch to Bamboo',
  cmd_theme_midnight: 'Switch to Midnight',
  cmd_theme_sunlight: 'Switch to Sunlight',
  cmd_category_chat: 'Chat',
  cmd_category_app: 'App',
  cmd_category_theme: 'Theme',
  cmd_category_skill: 'Skill',
  // Command palette skill labels
  cmd_skill_ppt: 'PPT Generator',
  cmd_skill_pdf: 'PDF Toolbox',
  cmd_skill_word: 'Word Suite',
  cmd_skill_excel: 'Excel Smart Processing',
  cmd_skill_video: 'Video Downloader',
  cmd_skill_image: 'Image Tools',
  cmd_skill_resume: 'Resume Builder',
  cmd_skill_paper: 'Paper Assistant',
  cmd_skill_contract: 'Contract Express',
  cmd_skill_search: 'Web Search',
  cmd_skill_email: 'Email Master',
  cmd_skill_convert: 'Format Converter',
  cmd_skill_automation: 'PC Automation',

  // Theme names
  theme_cherry: 'Cherry Blossom',
  theme_ocean: 'Deep Ocean',
  theme_bamboo: 'Bamboo',
  theme_midnight: 'Midnight',
  theme_sunlight: 'Sunlight',
} as const

export default en
