import { createContext, useContext, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Supported locales
// ---------------------------------------------------------------------------

export type Locale = 'zh' | 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'EN',
};

// ---------------------------------------------------------------------------
// Translation keys
// ---------------------------------------------------------------------------

const translations: Record<string, Record<Locale, string>> = {
  // ===== Welcome Screen =====
  'welcome.title': { zh: 'Music Arranger', en: 'Music Arranger' },
  'welcome.subtitle': {
    zh: '提供你的主旋律，我们将自动生成包含贝斯、和声、鼓组等多轨编曲，支持 128 种 GM 标准乐器。',
    en: 'Provide your main melody and we\'ll generate a full multi-track arrangement with bass, harmony, drums, and 128 GM instruments.',
  },
  'welcome.question': {
    zh: '你想如何提供主旋律？',
    en: 'How would you like to provide your melody?',
  },
  'welcome.or': { zh: '或者', en: 'or' },
  'welcome.drawManual': { zh: '手动绘制', en: 'Draw Manually' },
  'welcome.drawManualDesc': {
    zh: '在钢琴卷帘中逐个音符绘制旋律',
    en: 'Use the piano roll to draw your melody note by note',
  },
  'welcome.loadDemo': { zh: '加载示例', en: 'Load Demo' },
  'welcome.loadDemoDesc': {
    zh: '使用 C 大调音阶示例旋律快速体验',
    en: 'Start with a C major scale demo melody',
  },

  // ===== File Upload =====
  'upload.analyzing': { zh: '正在分析你的文件...', en: 'Analyzing your file...' },
  'upload.dragDrop': { zh: '将音乐文件拖放到此处', en: 'Drag & drop your music file here' },
  'upload.dropHere': { zh: '松开鼠标放置文件', en: 'Drop your file here' },
  'upload.clickBrowse': { zh: '或点击选择文件', en: 'or click to browse' },
  'upload.formats': {
    zh: '支持格式：MIDI (.mid) / 音频 (.wav, .mp3, .flac, .ogg, .aac) / MusicXML (.xml, .musicxml) / CSV',
    en: 'Supported: MIDI (.mid) / Audio (.wav, .mp3, .flac, .ogg, .aac) / MusicXML (.xml, .musicxml) / CSV',
  },
  'upload.noNotes': {
    zh: '未在文件中检测到音符，请尝试其他文件或手动绘制。',
    en: 'No notes detected in this file. Try a different file or draw manually.',
  },

  // ===== Sidebar =====
  'sidebar.melodyInput': { zh: '旋律输入', en: 'Melody Input' },
  'sidebar.melody': { zh: '旋律', en: 'Melody' },
  'sidebar.demo': { zh: '示例', en: 'Demo' },
  'sidebar.uploadFile': { zh: '上传文件', en: 'Upload File' },
  'sidebar.instruments': { zh: '乐器选择 (128 GM)', en: 'Instruments (128 GM)' },
  'sidebar.leadMelody': { zh: '主旋律', en: 'Lead Melody' },
  'sidebar.bass': { zh: '贝斯', en: 'Bass' },
  'sidebar.harmonyArp': { zh: '和声 / 琶音', en: 'Harmony / Arp' },

  // ===== Track List =====
  'trackList.title': { zh: '轨道', en: 'Tracks' },
  'trackList.empty': { zh: '生成编曲后显示轨道', en: 'Generate arrangement to see tracks' },

  // ===== Piano Roll Panel =====
  'pianoRoll.title': { zh: '钢琴卷帘', en: 'Piano Roll' },
  'pianoRoll.collapse': { zh: '收起', en: 'Collapse' },
  'pianoRoll.expand': { zh: '展开', en: 'Expand' },

  // ===== AI Generation =====
  'ai.generating': { zh: 'AI 编曲中...', en: 'AI Arranging...' },
  'ai.success': { zh: 'AI 编曲完成', en: 'AI arrangement complete' },
  'ai.fallback': { zh: '已使用本地引擎生成', en: 'Generated with local engine' },

  // ===== Transport =====
  'transport.rewind': { zh: '回到开头', en: 'Rewind' },
  'transport.play': { zh: '播放', en: 'Play' },
  'transport.pause': { zh: '暂停', en: 'Pause' },
  'transport.stop': { zh: '停止', en: 'Stop' },
  'transport.tempo': { zh: '速度', en: 'Tempo' },
  'transport.bars': { zh: '小节', en: 'Bars' },
  'transport.style': { zh: '风格', en: 'Style' },
  'transport.complexity': { zh: '丰富度', en: 'Complexity' },
  'transport.stylePop': { zh: '流行', en: 'Pop' },
  'transport.styleModal': { zh: '调式', en: 'Modal' },
  'transport.styleJazz': { zh: '爵士', en: 'Jazz' },
  'transport.complexityBasic': { zh: '基础', en: 'Basic' },
  'transport.complexityRich': { zh: '丰富', en: 'Rich' },

  // ===== Export Panel =====
  'export.keyEmpty': { zh: '调性: --', en: 'Key: --' },
  'export.chordsEmpty': { zh: '和弦: --', en: 'Chords: --' },
  'export.generate': { zh: '生成编曲', en: 'Generate Arrangement' },
  'export.generating': { zh: '生成中...', en: 'Generating...' },
  'export.downloadMidi': { zh: '下载 MIDI', en: 'Download MIDI' },
  'export.downloadJson': { zh: '下载 JSON', en: 'Download JSON' },

  // ===== Arrangement View =====
  'arrangement.header': { zh: '编曲', en: 'Arrangement' },
  'arrangement.tracks': { zh: '轨道', en: 'Tracks' },
  'arrangement.barsLabel': { zh: '小节', en: 'Bars' },
  'arrangement.emptyTitle': {
    zh: '点击上方 "生成编曲" 按钮',
    en: 'Click "Generate Arrangement" above',
  },
  'arrangement.emptyDesc': {
    zh: '左侧钢琴卷帘中已有旋律。点击"生成编曲"将自动生成贝斯、和声、鼓组等多轨编曲。你也可以在钢琴卷帘中绘制自己的旋律。',
    en: 'A demo melody is already loaded in the piano roll on the left. Click Generate to create a multi-track arrangement with bass, harmony, drums, and more.',
  },

  // ===== Main Panel =====
  'main.generateBtn': { zh: '生成编曲', en: 'Generate Arrangement' },
  'main.notesLoaded': { zh: '个音符已加载。点击生成贝斯、和声、鼓组等多轨编曲。', en: ' notes loaded. Click to generate bass, harmony, drums and more.' },
  'main.listenHint': {
    zh: '按空格键或点击播放按钮试听。使用右上角按钮下载 MIDI 或 JSON。',
    en: 'Press Space or click Play to listen. Use top-right buttons to download MIDI or JSON.',
  },

  // ===== Errors =====
  'error.noNotes': {
    zh: '没有音符可以编曲。请先在钢琴卷帘中绘制音符。',
    en: 'No notes to arrange. Draw some notes in the piano roll first.',
  },
  'error.noHarmony': {
    zh: '未找到适合此旋律和风格的和声方案。',
    en: 'No harmony candidates found for this melody and style.',
  },
  'error.generateFirst': {
    zh: '请先生成编曲。',
    en: 'Generate an arrangement first.',
  },
  'error.playbackFailed': { zh: '播放失败', en: 'Playback failed' },
  'error.stopFailed': { zh: '停止失败', en: 'Stop failed' },
  'error.midiExport': { zh: 'MIDI 导出失败', en: 'MIDI export failed' },
  'error.jsonExport': { zh: 'JSON 导出失败', en: 'JSON export failed' },

  // ===== User Guide =====
  'guide.title': { zh: '使用指南', en: 'User Guide' },
  'guide.close': { zh: '关闭', en: 'Close' },
  'guide.step1Title': { zh: '1. 提供主旋律', en: '1. Provide Your Melody' },
  'guide.step1Desc': {
    zh: '你可以通过三种方式提供主旋律：\n• 上传文件 — 支持 MIDI、WAV、MP3、FLAC、OGG、MusicXML、CSV 等格式\n• 手动绘制 — 在钢琴卷帘中点击格子绘制音符，拖拽可以画长音\n• 加载示例 — 一键加载 C 大调音阶体验完整流程',
    en: 'You can provide your melody in three ways:\n• Upload a file — supports MIDI, WAV, MP3, FLAC, OGG, MusicXML, CSV\n• Draw manually — click cells in the piano roll to place notes, drag for longer notes\n• Load demo — quickly load a C major scale to try the full workflow',
  },
  'guide.step2Title': { zh: '2. 配置参数', en: '2. Configure Parameters' },
  'guide.step2Desc': {
    zh: '在底部控制栏调整：\n• 速度 (Tempo) — 40-240 BPM\n• 小节数 (Bars) — 2-32 小节\n• 风格 — 流行 / 调式 / 爵士\n• 丰富度 — 基础（4轨）/ 丰富（5轨，含琶音）\n\n展开左侧"乐器选择"面板，可以从 128 种 GM 标准乐器中选择主旋律、贝斯、和声的音色。',
    en: 'Adjust in the bottom transport bar:\n• Tempo — 40-240 BPM\n• Bars — 2-32 bars\n• Style — Pop / Modal / Jazz\n• Complexity — Basic (4 tracks) / Rich (5 tracks with arpeggio)\n\nExpand the "Instruments" panel on the left to choose from 128 GM instruments for lead, bass, and harmony.',
  },
  'guide.step3Title': { zh: '3. 生成编曲', en: '3. Generate Arrangement' },
  'guide.step3Desc': {
    zh: '点击"生成编曲"按钮，系统将自动：\n• 检测旋律的调性（使用 Krumhansl-Schmuckler 算法）\n• 匹配最佳和弦进行\n• 生成贝斯线、和声垫、鼓组节奏等多个轨道\n\n右侧面板将显示所有轨道的音符可视化。',
    en: 'Click "Generate Arrangement" and the system will automatically:\n• Detect the key (using Krumhansl-Schmuckler algorithm)\n• Match the best chord progression\n• Generate bass line, harmony pad, drum pattern, and more\n\nThe right panel will show a visualization of all tracks.',
  },
  'guide.step4Title': { zh: '4. 试听与导出', en: '4. Listen & Export' },
  'guide.step4Desc': {
    zh: '• 按空格键或点击 ▶ 播放编曲\n• 点击 ⏸ 暂停，⏹ 停止\n• 下载 MIDI — 可导入任何 DAW（Logic Pro、Ableton、FL Studio 等）\n• 下载 JSON — 包含完整编曲数据，便于二次开发',
    en: '• Press Space or click ▶ to play the arrangement\n• Click ⏸ to pause, ⏹ to stop\n• Download MIDI — import into any DAW (Logic Pro, Ableton, FL Studio, etc.)\n• Download JSON — full arrangement data for further development',
  },
  'guide.supportedFormats': { zh: '支持的文件格式', en: 'Supported File Formats' },
  'guide.formatsDesc': {
    zh: '• MIDI (.mid, .midi) — 直接在浏览器解析，速度最快\n• 音频 (.wav, .aif, .aiff) — 原生音频分析\n• 压缩音频 (.mp3, .flac, .ogg, .aac, .m4a, .wma, .opus) — 需要后端服务\n• 乐谱 (.xml, .musicxml, .mxl) — MusicXML 标准格式\n• 数据 (.csv) — pitch, start, end, velocity 列格式',
    en: '• MIDI (.mid, .midi) — parsed in browser, fastest\n• Audio (.wav, .aif, .aiff) — native audio analysis\n• Compressed audio (.mp3, .flac, .ogg, .aac, .m4a, .wma, .opus) — requires backend\n• Sheet music (.xml, .musicxml, .mxl) — MusicXML standard\n• Data (.csv) — pitch, start, end, velocity columns',
  },
  'guide.help': { zh: '帮助', en: 'Help' },

  // ===== Demo source name =====
  'demo.name': { zh: '示例: C 大调音阶', en: 'Demo: C Major Scale' },
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function detectLocale(): Locale {
  const lang = navigator.language || '';
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}

// ---------------------------------------------------------------------------
// Context (will be used via React.createElement in the provider)
// ---------------------------------------------------------------------------

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useI18n() {
  return useContext(I18nContext);
}

// ---------------------------------------------------------------------------
// Provider hook (returns value for the context provider)
// ---------------------------------------------------------------------------

export function useI18nProvider() {
  const [locale, setLocale] = useState<Locale>(detectLocale);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const entry = translations[key];
    if (!entry) return key;
    let text = entry[locale] || entry['en'] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  return { locale, setLocale, t };
}
