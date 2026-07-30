export type Lang = 'en' | 'tr'

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'tr', name: 'Türkçe' },
]

const KEY = 'tuval:lang'

const tr: Record<string, string> = {
  // top bar
  'Board name': 'Board adı',
  'item': 'öğe',
  'items': 'öğe',
  'frame': 'frame',
  'frames': 'frame',
  'Board menu': 'Board menüsü',
  'Frame panel': 'Frame paneli',
  'Version history': 'Sürüm geçmişi',
  'Download PNG': 'PNG indir',
  'Print frames as PDF': 'Frame\'leri PDF yazdır',
  'Surface': 'Zemin',
  'Texture': 'Doku',
  'Language': 'Dil',
  'Clear board': 'Board\'u temizle',
  'Delete everything on this board?': 'Board\'daki her şey silinsin mi?',
  'Search — ⌘F': 'Ara — ⌘F',
  'Copy link': 'Bağlantıyı kopyala',
  'Present': 'Sunum',
  'At least one frame is needed to present.': 'Sunum için en az bir frame gerekiyor.',
  'At least one frame is needed for PDF.': 'PDF için en az bir frame gerekiyor.',

  // surfaces
  'Paper': 'Kağıt',
  'Whitewash': 'Badana',
  'Sand': 'Kum',
  'Linen': 'Keten',
  'Clay': 'Kil',
  'Celadon': 'Seladon',
  'Mist': 'Sis',
  'Grey board': 'Gri karton',
  'Blueprint': 'Mavi baskı',
  'Slate': 'Kara tahta',

  // textures
  'Registration': 'Tescil',
  'Dots': 'Nokta',
  'Grid': 'Kareli',
  'Ruled': 'Çizgili',
  'Plain': 'Düz',

  // tools
  'Undo': 'Geri al',
  'Redo': 'İleri al',
  'Select': 'Seç',
  'Sticky': 'Sticky',
  'Text': 'Metin',
  'Shape': 'Şekil',
  'Connector': 'Bağlantı',
  'Pen': 'Kalem',
  'Table': 'Tablo',
  'Mind map': 'Zihin haritası',
  'Frame': 'Frame',
  'Comment': 'Yorum',
  'Code block': 'Kod bloğu',
  'Templates': 'Şablonlar',
  'Image': 'Görsel',
  'Upload image': 'Görsel yükle',
  'More': 'Daha fazla',
  'Minimap': 'Minimap',
  'Fit to content': 'İçeriğe sığdır',
  'Zoom': 'Zoom',
  'Zoom out': 'Uzaklaş',
  'Zoom in': 'Yakınlaş',
  'Eraser': 'Silgi',
  'Highlighter': 'Fosforlu',
  'Drawing': 'Çizim',
  'Embed': 'Gömülü',

  // dock settings
  'Dock settings (right click)': 'Dock ayarları (sağ tık)',
  'Position': 'Konum',
  'Bottom': 'Alt',
  'Top': 'Üst',
  'Left': 'Sol',
  'Right': 'Sağ',
  'Size': 'Boyut',
  'Magnifier': 'Büyüteç',
  'Visible tools': 'Görünen araçlar',
  'Reset to default': 'Varsayılana dön',
  'On': 'Açık',
  'Off': 'Kapalı',

  // inspector
  'Fill': 'Dolgu',
  'Line': 'Çizgi',
  'Opacity': 'Opaklık',
  'Sticky size': 'Sticky boyutu',
  'Fit to text': 'Metne sığdır',
  'Layout': 'Düzen',
  'Code': 'Kod',
  'Light theme': 'Açık tema',
  'Dark theme': 'Koyu tema',
  'Line numbers': 'Satır numarası',
  'Bold': 'Kalın',
  'Italic': 'İtalik',
  'Underline': 'Altı çizili',
  'Strikethrough': 'Üstü çizili',
  'Bring forward': 'Öne getir',
  'Send backward': 'Arkaya gönder',
  'Lock': 'Kilitle',
  'Unlock': 'Kilidi aç',
  'Duplicate': 'Çoğalt',
  'Delete': 'Sil',
  'Align': 'Hizala',

  // search
  'Search the board…': 'Board içinde ara…',
  'No results': 'Sonuç yok',
  'navigate': 'gez',
  'go': 'git',
  'go, keep open': 'git, açık kal',

  // collaborators
  'people on this board': 'kişi bu board\'da',
  'On the board': 'Board\'da',
  'people': 'kişi',
  '(you)': '(sen)',
  'following': 'takipte',
  'follow': 'takip et',
  'Stop following': 'Takibi bırak',

  // handoff
  'Hand off to AI': 'AI\'ya devret',
  'Open in {app}': '{app}\'da aç',
  'Copy prompt': 'Prompt\'u kopyala',
  'Download Markdown': 'Markdown indir',
  'Download JSON': 'JSON indir',
  'Whole board': 'Tüm board',
  'Selection ({n})': 'Seçim ({n})',
  'Prompt copied. Paste it into Claude Code, Cursor or Codex.':
    'Prompt panoya kopyalandı. Claude Code, Cursor veya Codex\'e yapıştır.',
  'Board is too large for a URL — the prompt was copied, paste it into the chat.':
    'Board bir URL için fazla büyük — prompt panoya kopyalandı, sohbete yapıştır.',
  'Frames become sections, arrows become a mermaid flow, code blocks become fenced code. Reading order is top to bottom, left to right.':
    'Frame\'ler bölüme, oklar mermaid akışına, kod blokları fenced code\'a dönüşür. Okuma sırası yukarıdan aşağı, soldan sağa.',

  // comments
  'No comments yet. Drop a pin with the comment tool.':
    'Henüz yorum yok. Yorum aracıyla tuvale pin bırak.',
  'No open comments.': 'Açık yorum yok.',
  'Mark resolved': 'Çözüldü işaretle',
  'Reopen': 'Yeniden aç',
  'Hide resolved': 'Çözülmüşleri gizle',
  'Show resolved ({n})': 'Çözülmüşleri göster ({n})',
  'just now': 'az önce',
  'now': 'şimdi',
  '{n} min ago': '{n} dk önce',
  '{n} h ago': '{n} sa önce',

  // history
  'Saved version': 'Kaydedilen sürüm',
  'Version name': 'Sürüm adı',
  'Checkpoint': 'Kontrol noktası',
  'Restore version "{name}"? The current state is saved first.':
    '"{name}" sürümüne dönülsün mü? Şu anki hâl önce kaydedilir.',

  // context menu
  'Paste style': 'Stili yapıştır',
  'Select frame contents': 'Frame içindekileri seç',
  'Reset bends': 'Kırılmaları sıfırla',
  'Export as PNG': 'PNG olarak dışa aktar',
  'Open link': 'Bağlantıyı aç',
  '⌘click': '⌘tık',

  // embed
  'Link to embed (YouTube, Vimeo, Loom, Figma or any site)':
    'Gömülecek bağlantı (YouTube, Vimeo, Loom, Figma veya herhangi bir site)',

  // templates
  'Untitled board': 'Adsız board',
  'Flowchart': 'Akış şeması',
  'Start → decision → outcome': 'Başlangıç → karar → sonuç',
  '4×3 idea grid': '4×3 fikir ızgarası',
  'Start': 'Başlangıç',
  'End': 'Bitiş',
  'Condition?': 'Koşul?',
  'No path': 'Hayır yolu',
  'Solution': 'Çözüm',
  'Before going back': 'Geri dönmeden önce',
  'User interviews': 'Kullanıcı görüşmeleri',
  'Pricing page': 'Fiyatlandırma sayfası',
  'Users': 'Kullanıcılar',
  'Onboarding flow': 'Onboarding akışı',

  // agent export
  'Outside frames': 'Frame dışı',
  'Flow': 'Akış',
  'Comments': 'Yorumlar',
  '(empty {kind})': '(boş {kind})',
  'On "{name}"': '"{name}" üzerinde',
  'Free': 'Serbest',
  'Infinite canvas export · {items} items · {frames} frames · {edges} connections':
    'Sonsuz tuval dışa aktarımı · {items} öğe · {frames} frame · {edges} bağlantı',
  // dock extras
  'Open frame panel': 'Frame panelini aç',
  'Embed a link': 'Bağlantı göm',
  'Frame size': 'Frame boyutu',
  'Drag tools to reorder them.': 'Araçları sürükleyerek sıralayabilirsin.',

  // inspector extras
  'Thickness': 'Kalınlık',
  'Light': 'Açık',
  'Dark': 'Koyu',
  'Add row': 'Satır ekle',
  'Add column': 'Sütun ekle',
  'Remove row': 'Satır sil',
  'Remove column': 'Sütun sil',
  'Header row': 'Başlık satırı',
  'Distribute horizontally': 'Yatayda eşit dağıt',
  'Distribute vertically': 'Dikeyde eşit dağıt',
  'Align left': 'Sola',
  'Align right': 'Sağa',
  'Align top': 'Üste',
  'Align bottom': 'Alta',
  'Center horizontally': 'Yatay ortala',
  'Center vertically': 'Dikey ortala',

  // panels
  'Versions': 'Sürümler',
  'Save current state': 'Şu anki hâli kaydet',
  'No versions yet. The board is also saved automatically every 10 minutes.':
    'Henüz sürüm yok. Board her 10 dakikada bir kendiliğinden de kaydedilir.',
  'Restore this version': 'Bu sürüme dön',
  'Start presentation': 'Sunumu başlat',
  'Print as PDF': 'PDF olarak yazdır',
  'No frames yet. Use the frame tool in the dock.':
    'Henüz frame yok. Dock\'taki frame aracını kullan.',
  'Double click to rename': 'Çift tıkla: yeniden adlandır',
  'Move up': 'Yukarı taşı',
  'Move down': 'Aşağı taşı',
  'Double click to use the content': 'Çift tıkla: içeriği kullan',
  'Exit': 'Çıkış',
  'Say something…': 'Bir şey söyle…',
  'Participant': 'Katılımcı',
  'Send': 'Gönder',
  'resolved': 'çözüldü',
  'replies': 'yanıt',
  '(empty)': '(boş)',

  // templates
  'Problem': 'Sorun',
  'Risks': 'Riskler',
  'Metrics': 'Metrikler',

  // agent brief
  'The content below was exported from an infinite canvas board. Frames are sections, bullets are items on the canvas (reading order: top to bottom, left to right), and the mermaid graph under "Flow" represents the arrows between items. First summarise in one paragraph what is being asked for, then break it into concrete steps.':
    'Aşağıdaki içerik bir sonsuz tuval board\'ından dışa aktarıldı. Frame\'ler bölüm, madde işaretleri tuvaldeki öğeler (okuma sırası: yukarıdan aşağı, soldan sağa), "Akış" bölümündeki mermaid grafiği öğeler arasındaki okları temsil eder. Önce ne yapılmak istendiğini bir paragrafta özetle, sonra somut adımlara dök.',
  // brief import
  'Build a board from a brief': 'Brief\'ten board oluştur',
  'Paste Markdown or JSON here. Headings become frames, bullets become stickies, fenced code becomes code blocks, a mermaid flow becomes connectors.':
    'Markdown veya JSON yapıştır. Başlıklar frame, maddeler sticky, fenced code kod bloğu, mermaid akışı bağlantı olur.',
  'Paste an example': 'Örnek yapıştır',
  'Nothing to read yet': 'Okunacak bir şey yok',
  'connections': 'bağlantı',
  'Create': 'Oluştur',
  // sticky status
  'Status': 'Durum',
  'Idea': 'Fikir',
  'Question': 'Soru',
  'Doing': 'Yapılıyor',
  'Blocked': 'Engelli',
  'Decision': 'Karar',
  'Done': 'Bitti',
  'None': 'Yok',
}

const CATALOG: Record<Lang, Record<string, string> | null> = { en: null, tr }

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && saved in CATALOG) return saved
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('tr') ? 'tr' : 'en'
}

let lang: Lang = detect()
const listeners = new Set<() => void>()

export const getLang = () => lang

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function t(source: string, vars?: Record<string, string | number>): string {
  const out = CATALOG[lang]?.[source] ?? source
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (whole, key) => String(vars[key] ?? whole))
}
